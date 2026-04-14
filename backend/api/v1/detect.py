"""POST /api/v1/detect — lightweight YOLO-World detection (no Gemini).

Returns only bounding boxes for real-time overlay on the frontend.
Designed to be called frequently (~2-3 FPS) for live tracking.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.yolo_service import detect_objects

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["detect"])


class DetectRequest(BaseModel):
    image: str = Field(description="Base64-encoded JPEG image")


class DetectedObject(BaseModel):
    label: str
    confidence: float
    x: float
    y: float
    width: float
    height: float


class DetectResponse(BaseModel):
    objects: list[DetectedObject]


@router.post("/detect", response_model=DetectResponse)
async def detect(req: DetectRequest) -> DetectResponse:
    try:
        detections = detect_objects(req.image)
        return DetectResponse(
            objects=[
                DetectedObject(
                    label=d.label,
                    confidence=d.confidence,
                    x=d.x,
                    y=d.y,
                    width=d.width,
                    height=d.height,
                )
                for d in detections
            ]
        )
    except Exception as exc:
        logger.exception("Detection failed")
        raise HTTPException(status_code=500, detail=str(exc))
