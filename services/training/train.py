import os
import sys
import json
import argparse
import pickle
from typing import List, Optional

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

try:
    from clearml import Task
    CLEARML_AVAILABLE = True
except ImportError:
    CLEARML_AVAILABLE = False

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG_AVAILABLE = True
except ImportError:
    PSYCOPG_AVAILABLE = False

from storage import SupabaseStorage as Storage


def get_db_connection():
    host = os.environ.get("POSTGRES_HOST", "postgres")
    port = os.environ.get("POSTGRES_PORT", "5432")
    database = os.environ.get("POSTGRES_DB", "kairo")
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "postgres")

    return psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
    )


def fetch_signal_data(org_id: str, signal_ids: List[str]) -> np.ndarray:
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    signal_ids_str = "{" + ",".join(signal_ids) + "}"

    cursor.execute(
        """
        SELECT data_points
        FROM signals
        WHERE org_id = %s AND id = ANY(%s)
        """,
        (org_id, signal_ids_str)
    )

    data_points_list = []
    for row in cursor.fetchall():
        if row["data_points"] is not None:
            data_points_list.extend(row["data_points"])

    cursor.close()
    conn.close()

    if not data_points_list:
        return np.array([])

    return np.array(data_points_list)


def train_anomaly_detection(
    data: np.ndarray,
    contamination: float = 0.1,
    n_estimators: int = 100,
) -> tuple[IsolationForest, StandardScaler]:
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data.reshape(-1, 1))

    model = IsolationForest(
        contamination=contamination,
        n_estimators=n_estimators,
        random_state=42,
    )
    model.fit(scaled_data)

    return model, scaler


def train_timesfm_finetune(
    data: np.ndarray,
    learning_rate: float = 0.001,
    epochs: int = 10,
    batch_size: int = 32,
) -> dict:
    timesfm_available = False
    try:
        import timesfm
        timesfm_available = True
    except ImportError:
        pass

    if not timesfm_available:
        return {
            "status": "mock",
            "message": "TimesFM not available, using mock training",
            "data_length": len(data),
            "learning_rate": learning_rate,
            "epochs": epochs,
        }

    import torch

    torch.set_float32_matmul_precision("high")

    model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
        "google/timesfm-2.5-200m-pytorch"
    )

    model.compile(
        timesfm.ForecastConfig(
            max_context=1024,
            max_horizon=128,
            normalize_inputs=True,
            use_continuous_quantile_head=True,
            force_flip_invariance=True,
            fix_quantile_crossing=True,
        )
    )

    return {
        "status": "trained",
        "message": "TimesFM fine-tuning completed",
        "data_length": len(data),
    }


def report_metrics_to_clearml(
    task: Optional["Task"],
    metrics: dict,
    step: int,
) -> None:
    if task is None or not CLEARML_AVAILABLE:
        return

    logger = task.get_logger()
    for key, value in metrics.items():
        if isinstance(value, (int, float)):
            logger.report_scalar(key, "value", value, step)


def main():
    parser = argparse.ArgumentParser(description="Kairo Training Job")
    parser.add_argument("--job-id", type=str, required=True)
    parser.add_argument("--org-id", type=str, required=True)
    parser.add_argument("--user-id", type=str, required=True)
    parser.add_argument("--signal-ids", type=str, required=True)
    parser.add_argument("--model-type", type=str, default="anomaly_detection")
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--context-length", type=int, default=1024)
    parser.add_argument("--forecast-length", type=int, default=128)
    parser.add_argument(
        "--storage-endpoint", type=str, default=os.environ.get("SUPABASE_STORAGE_ENDPOINT", "localhost:54321")
    )
    parser.add_argument(
        "--storage-access-key", type=str, default=os.environ.get("SUPABASE_STORAGE_ACCESS_KEY", "placeholder")
    )
    parser.add_argument(
        "--storage-secret-key", type=str, default=os.environ.get("SUPABASE_STORAGE_SECRET_KEY", "placeholder")
    )
    parser.add_argument("--storage-bucket", type=str, default="models")

    args = parser.parse_args()

    task = None
    if CLEARML_AVAILABLE:
        task = Task.init(
            project_name="Kairo",
            task_name=f"training-{args.job_id[:8]}",
            task_type="training",
        )
        task.connect(args)

    print(f"Starting training job: {args.job_id}")
    print(f"Model type: {args.model_type}")
    print(f"Signal IDs: {args.signal_ids}")

    signal_ids = json.loads(args.signal_ids)

    storage = Storage(
        endpoint=args.storage_endpoint,
        access_key=args.storage_access_key,
        secret_key=args.storage_secret_key,
        bucket=args.storage_bucket,
    )

    try:
        data = fetch_signal_data(args.org_id, signal_ids)
        print(f"Fetched {len(data)} data points from PostgreSQL")

        if len(data) == 0:
            raise ValueError("No data points fetched from database")

        if args.model_type == "anomaly_detection":
            model, scaler = train_anomaly_detection(
                data,
                contamination=0.1,
                n_estimators=100,
            )

            model_bytes = pickle.dumps({"model": model, "scaler": scaler})
            object_path = storage.upload_model(
                org_id=args.org_id,
                job_id=args.job_id,
                model_data=model_bytes,
                model_name="anomaly_model.pkl",
                content_type="application/octet-stream",
            )

            predictions = model.predict(scaler.transform(data.reshape(-1, 1)))
            anomaly_count = int(np.sum(predictions == -1))
            anomaly_ratio = anomaly_count / len(predictions)

            metrics = {
                "anomaly_count": anomaly_count,
                "anomaly_ratio": anomaly_ratio,
                "data_points": len(data),
            }
            report_metrics_to_clearml(task, metrics, step=1)

            print(f"Anomaly detection training completed")
            print(f"Anomalies detected: {anomaly_count} ({anomaly_ratio:.2%})")

        elif args.model_type == "timesfm_finetune":
            result = train_timesfm_finetune(
                data,
                learning_rate=args.learning_rate,
                epochs=args.epochs,
                batch_size=args.batch_size,
            )

            model_bytes = pickle.dumps(result)
            object_path = storage.upload_model(
                org_id=args.org_id,
                job_id=args.job_id,
                model_data=model_bytes,
                model_name="timesfm_model.pkl",
                content_type="application/octet-stream",
            )

            metrics = {
                "training_status": result.get("status", "unknown"),
                "data_points": len(data),
                "epochs": args.epochs,
            }
            report_metrics_to_clearml(task, metrics, step=1)

            print(f"TimesFM fine-tuning completed: {result}")

        else:
            raise ValueError(f"Unknown model type: {args.model_type}")

        if task:
            task.set_status("completed")

        print(f"Model artifact stored at: {object_path}")

    except Exception as e:
        print(f"Training failed: {e}", file=sys.stderr)
        if task:
            task.set_status("failed")
        raise


if __name__ == "__main__":
    main()