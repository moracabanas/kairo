import os
import io
from typing import Optional

from minio import Minio
from minio.error import S3Error


class SupabaseStorage:
    def __init__(
        self,
        endpoint: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        bucket: str = "models",
        secure: bool = False,
    ):
        self.endpoint = endpoint or os.environ.get("SUPABASE_STORAGE_ENDPOINT", "localhost:54321")
        self.access_key = access_key or os.environ.get("SUPABASE_STORAGE_ACCESS_KEY", "placeholder")
        self.secret_key = secret_key or os.environ.get("SUPABASE_STORAGE_SECRET_KEY", "placeholder")
        self.bucket = bucket
        self.secure = secure

        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.secure,
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error as e:
            raise RuntimeError(f"Failed to create bucket '{self.bucket}': {e}")

    def upload_model(
        self,
        org_id: str,
        job_id: str,
        model_data: bytes,
        model_name: str = "model.pt",
        content_type: str = "application/octet-stream",
    ) -> str:
        object_path = f"{org_id}/{job_id}/{model_name}"

        try:
            data = io.BytesIO(model_data)
            self.client.put_object(
                self.bucket,
                object_path,
                data,
                length=len(model_data),
                content_type=content_type,
            )
            return object_path
        except S3Error as e:
            raise RuntimeError(f"Failed to upload model to '{object_path}': {e}")

    def download_model(
        self,
        org_id: str,
        job_id: str,
        model_name: str = "model.pt",
    ) -> bytes:
        object_path = f"{org_id}/{job_id}/{model_name}"

        try:
            response = self.client.get_object(self.bucket, object_path)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            raise RuntimeError(f"Failed to download model from '{object_path}': {e}")

    def model_exists(
        self,
        org_id: str,
        job_id: str,
        model_name: str = "model.pt",
    ) -> bool:
        object_path = f"{org_id}/{job_id}/{model_name}"

        try:
            self.client.stat_object(self.bucket, object_path)
            return True
        except S3Error:
            return False

    def get_model_path(
        self,
        org_id: str,
        job_id: str,
        model_name: str = "model.pt",
    ) -> str:
        return f"{self.bucket}/{org_id}/{job_id}/{model_name}"