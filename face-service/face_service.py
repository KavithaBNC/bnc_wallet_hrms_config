"""
Face encoding and comparison microservice for HRMS.
Endpoints: /generate-encoding (base64 -> 128-float array), /compare-faces, /match-face.
Runs without face_recognition if dlib is not installed; encode/match then return a clear error.
"""
import base64
import io
from typing import List, Optional

try:
    import face_recognition
    import numpy as np
    HAS_FACE_RECOGNITION = True
except ImportError:
    face_recognition = None
    np = None
    HAS_FACE_RECOGNITION = False

from fastapi import FastAPI
from pydantic import BaseModel, Field

NOT_INSTALLED_MSG = (
    "face_recognition not installed (dlib build failed). "
    "Options: run face-service in Docker (see face-service/README.md), use Python 3.10/3.11 with conda-forge, or install CMake and Visual C++ Build Tools."
)

app = FastAPI(title="HRMS Face Service", version="1.0.0")


class GenerateEncodingRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image (with or without data URL prefix)")


class GenerateEncodingResponse(BaseModel):
    encoding: Optional[List[float]] = None
    error: Optional[str] = None


class CompareFacesRequest(BaseModel):
    live_base64: str = Field(..., description="Base64-encoded live/capture image")
    stored_encoding: List[float] = Field(..., description="Stored 128-float face encoding")


class CompareFacesResponse(BaseModel):
    match: bool
    distance: float
    error: Optional[str] = None


class StoredEncodingItem(BaseModel):
    employee_id: str
    encoding: List[float]


class MatchFaceRequest(BaseModel):
    live_base64: str = Field(..., description="Base64-encoded live/capture image")
    stored_encodings: List[StoredEncodingItem] = Field(..., description="List of employee id + encoding")


class MatchFaceResponse(BaseModel):
    matched_employee_id: Optional[str] = None
    distance: Optional[float] = None
    match: bool = False
    error: Optional[str] = None


def _decode_image(b64: str):
    """Decode base64 to RGB array for face_recognition (expects RGB)."""
    raw = b64.strip()
    if raw.startswith("data:"):
        raw = raw.split(",", 1)[-1]
    buf = base64.b64decode(raw)
    img = face_recognition.load_image_file(io.BytesIO(buf))
    if img.ndim == 2:
        pass
    elif img.shape[2] == 4:
        img = img[:, :, :3]
    return img


@app.post("/generate-encoding", response_model=GenerateEncodingResponse)
def generate_encoding(req: GenerateEncodingRequest):
    """Accept base64 image; return 128-float face encoding or error if no face detected."""
    if not HAS_FACE_RECOGNITION:
        return GenerateEncodingResponse(encoding=None, error=NOT_INSTALLED_MSG)
    try:
        img = _decode_image(req.image_base64)
        encodings = face_recognition.face_encodings(img)
        if not encodings:
            return GenerateEncodingResponse(encoding=None, error="no face detected")
        enc = encodings[0]
        return GenerateEncodingResponse(encoding=enc.tolist(), error=None)
    except Exception as e:
        return GenerateEncodingResponse(encoding=None, error=str(e))


@app.post("/compare-faces", response_model=CompareFacesResponse)
def compare_faces(req: CompareFacesRequest):
    """Compare live base64 image to one stored encoding; return match and distance."""
    if not HAS_FACE_RECOGNITION:
        return CompareFacesResponse(match=False, distance=0.0, error=NOT_INSTALLED_MSG)
    try:
        img = _decode_image(req.live_base64)
        live_encodings = face_recognition.face_encodings(img)
        if not live_encodings:
            return CompareFacesResponse(match=False, distance=0.0, error="no face detected")
        live_enc = np.array(req.stored_encoding, dtype=np.float64)
        if live_enc.shape != (128,):
            return CompareFacesResponse(match=False, distance=0.0, error="invalid stored encoding length")
        known = [live_enc]
        distances = face_recognition.face_distance(known, live_encodings[0])
        distance = float(distances[0])
        match = distance < 0.6
        return CompareFacesResponse(match=match, distance=distance, error=None)
    except Exception as e:
        return CompareFacesResponse(match=False, distance=0.0, error=str(e))


@app.post("/match-face", response_model=MatchFaceResponse)
def match_face(req: MatchFaceRequest):
    """Find which stored encoding matches the live image; return employee_id and distance if match."""
    if not HAS_FACE_RECOGNITION:
        return MatchFaceResponse(matched_employee_id=None, distance=None, match=False, error=NOT_INSTALLED_MSG)
    try:
        img = _decode_image(req.live_base64)
        live_encodings = face_recognition.face_encodings(img)
        if not live_encodings:
            return MatchFaceResponse(matched_employee_id=None, distance=None, match=False, error="no face detected")
        live_enc = live_encodings[0]
        if not req.stored_encodings:
            return MatchFaceResponse(matched_employee_id=None, distance=None, match=False, error="no stored encodings")
        known_encodings = [np.array(x.encoding, dtype=np.float64) for x in req.stored_encodings]
        distances = face_recognition.face_distance(known_encodings, live_enc)
        best_idx = int(np.argmin(distances))
        best_distance = float(distances[best_idx])
        if best_distance >= 0.6:
            return MatchFaceResponse(matched_employee_id=None, distance=best_distance, match=False, error=None)
        return MatchFaceResponse(
            matched_employee_id=req.stored_encodings[best_idx].employee_id,
            distance=best_distance,
            match=True,
            error=None,
        )
    except Exception as e:
        return MatchFaceResponse(matched_employee_id=None, distance=None, match=False, error=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
