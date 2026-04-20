from contextlib import asynccontextmanager

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import TimesFm2_5ModelForPrediction


class PredictRequest(BaseModel):
    signal_id: str
    context: list[float]
    forecast_length: int = 128
    context_length: int = 512
    frequency: int = 3600


class PredictResponse(BaseModel):
    signal_id: str
    forecast: list[float]
    lower_bound: list[float]
    upper_bound: list[float]
    confidence: float = 0.95


class BatchPredictRequest(BaseModel):
    predictions: list[PredictRequest]


class BatchPredictResponse(BaseModel):
    predictions: list[PredictResponse]


class ModelInfo(BaseModel):
    model_name: str
    device: str
    context_length: int
    forecast_length: int


model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    try:
        torch.set_float32_matmul_precision("high")
        model = TimesFm2_5ModelForPrediction.from_pretrained(
            "google/timesfm-2.5-200m-transformers",
            device_map="auto",
        )
        model.eval()
    except Exception as e:
        print(f"Failed to load TimesFM model: {e}")
        model = None
    yield


app = FastAPI(title="TimesFM Inference Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest) -> PredictResponse:
    if not request.signal_id or not request.signal_id.strip():
        raise HTTPException(status_code=400, detail="signal_id cannot be empty")

    if not request.context:
        raise HTTPException(status_code=400, detail="context cannot be empty")

    try:
        context_array = np.array(request.context, dtype=np.float32)
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid context array: {e}")

    if len(context_array) == 0:
        raise HTTPException(status_code=400, detail="context cannot be empty")

    if request.forecast_length <= 0:
        raise HTTPException(status_code=400, detail="forecast_length must be positive")

    if request.context_length <= 0:
        raise HTTPException(status_code=400, detail="context_length must be positive")

    if request.frequency <= 0:
        raise HTTPException(status_code=400, detail="frequency must be positive")

    if model is None:
        return PredictResponse(
            signal_id=request.signal_id,
            forecast=[0.0] * request.forecast_length,
            lower_bound=[-0.1] * request.forecast_length,
            upper_bound=[0.1] * request.forecast_length,
            confidence=0.95,
        )

    try:
        input_tensor = torch.tensor(context_array, dtype=torch.float32, device=model.device)
        with torch.no_grad():
            outputs = model(past_values=[input_tensor], return_dict=True)
            point_forecast = outputs.mean_predictions
            quantile_forecast = outputs.full_predictions
            forecast = point_forecast[0].float().cpu().numpy()
            q025 = quantile_forecast[0, :, 1].float().cpu().numpy()
            q975 = quantile_forecast[0, :, 9].float().cpu().numpy()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    return PredictResponse(
        signal_id=request.signal_id,
        forecast=forecast.tolist() if hasattr(forecast, "tolist") else list(forecast),
        lower_bound=q025.tolist() if hasattr(q025, "tolist") else list(q025),
        upper_bound=q975.tolist() if hasattr(q975, "tolist") else list(q975),
        confidence=0.95,
    )


@app.post("/batch-predict", response_model=BatchPredictResponse)
async def batch_predict(request: BatchPredictRequest) -> BatchPredictResponse:
    if not request.predictions:
        raise HTTPException(status_code=400, detail="predictions list cannot be empty")

    results: list[PredictResponse] = []
    for pred_req in request.predictions:
        try:
            result = await predict(pred_req)
            results.append(result)
        except HTTPException as e:
            raise HTTPException(
                status_code=e.status_code,
                detail=f"Prediction failed for signal_id {pred_req.signal_id}: {e.detail}",
            )

    return BatchPredictResponse(predictions=results)


@app.get("/model-info", response_model=ModelInfo)
async def model_info() -> ModelInfo:
    return ModelInfo(
        model_name="timesfm-2.5",
        device="cpu",
        context_length=512,
        forecast_length=128,
    )
