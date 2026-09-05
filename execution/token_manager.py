"""
Signed Scoped QR Token Manager for Project AIR.
Issues and verifies HMAC-SHA256 time-boxed tokens for Site Supervisor PWA access.
"""
import os
import time
import json
import hmac
import hashlib
import base64
from typing import Dict, Any, Optional

SECRET_KEY = os.environ.get("JWT_SECRET", "super_secret_air_construction_key_2026").encode("utf-8")

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def _base64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + padding)

def generate_scoped_token(po_id: str, site_id: str, expires_in_seconds: int = 86400 * 7, created_by: str = "HQ_PROCUREMENT") -> str:
    """
    Generates a secure HMAC-SHA256 signed token scoped to a specific PO and Project Site.
    """
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "po_id": po_id,
        "site_id": site_id,
        "iat": now,
        "exp": now + expires_in_seconds,
        "created_by": created_by
    }
    
    header_b64 = _base64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(payload).encode("utf-8"))
    
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY, signing_input, hashlib.sha256).digest()
    signature_b64 = _base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_scoped_token(token: str) -> Dict[str, Any]:
    """
    Verifies the HMAC signature and expiration of the token.
    Raises ValueError if invalid or expired.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token: must contain header, payload, and signature.")
    
    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(SECRET_KEY, signing_input, hashlib.sha256).digest()
    try:
        actual_sig = _base64url_decode(signature_b64)
    except Exception as e:
        raise ValueError(f"Invalid token signature formatting: {e}")
    
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid token signature: token has been tampered with.")
    
    payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
    now = int(time.time())
    
    if "exp" in payload and payload["exp"] < now:
        raise ValueError(f"Token expired at {payload['exp']}; current time is {now}.")
        
    return payload

if __name__ == "__main__":
    t = generate_scoped_token("PO-2026-001", "SITE-ALPHA-WEST")
    print("Generated token:", t)
    v = verify_scoped_token(t)
    print("Verified payload:", v)
