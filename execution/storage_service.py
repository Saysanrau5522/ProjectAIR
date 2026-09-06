"""
Storage Service for Project AIR.
Supports:
- Local filesystem storage (development default)
- Cloudflare R2 / AWS S3 (production scalable object storage with zero egress fees)
"""
import os
from pathlib import Path
from typing import Tuple

STORAGE_PROVIDER = os.environ.get("STORAGE_PROVIDER", "local").lower()
LOCAL_STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", "./storage"))
LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Cloudflare R2 Configuration
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "project-air-documents")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "")  # Optional: custom domain or https://pub-xxx.r2.dev

def get_s3_client():
    """
    Initializes standard S3 client configured for Cloudflare R2 endpoint.
    """
    import boto3
    endpoint_url = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto"
    )

def save_document(file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> Tuple[str, str]:
    """
    Saves file to either Local Storage or Cloudflare R2 depending on configuration.
    Returns (storage_filename, accessible_url).
    """
    if STORAGE_PROVIDER in ("r2", "cloudflare", "s3") and R2_ACCOUNT_ID and R2_ACCESS_KEY_ID:
        try:
            client = get_s3_client()
            client.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=filename,
                Body=file_bytes,
                ContentType=content_type
            )
            print(f"[Storage] Successfully uploaded {filename} to Cloudflare R2 bucket: {R2_BUCKET_NAME}")
            if R2_PUBLIC_URL:
                url = f"{R2_PUBLIC_URL.rstrip('/')}/{filename}"
            else:
                url = f"/api/storage/{filename}"
            return filename, url
        except Exception as e:
            print(f"[Storage] Cloudflare R2 upload error: {e}. Falling back to local storage.")

    # Local filesystem storage fallback
    local_path = LOCAL_STORAGE_DIR / filename
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    return filename, f"/storage/{filename}"

def get_document_bytes(filename: str) -> bytes:
    """
    Retrieves document binary bytes from Cloudflare R2 or Local Storage.
    """
    if STORAGE_PROVIDER in ("r2", "cloudflare", "s3") and R2_ACCOUNT_ID and R2_ACCESS_KEY_ID:
        try:
            client = get_s3_client()
            response = client.get_object(Bucket=R2_BUCKET_NAME, Key=filename)
            return response["Body"].read()
        except Exception as e:
            print(f"[Storage] Could not fetch from R2: {e}. Checking local disk.")

    local_path = LOCAL_STORAGE_DIR / filename
    if local_path.exists():
        with open(local_path, "rb") as f:
            return f.read()
    raise FileNotFoundError(f"Document '{filename}' not found.")
