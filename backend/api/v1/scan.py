"""POST /api/v1/scan — hybrid pipeline: YOLO + MediaPipe + Gemini."""

import logging

from fastapi import APIRouter, HTTPException

from backend.models.schemas import ScanRequest, ScanResponse
from backend.services.gemini_service import get_visual_audit
from backend.services.yolo_service import detect_objects, format_yolo_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["scan"])


@router.post("/scan", response_model=ScanResponse)
async def scan(req: ScanRequest) -> ScanResponse:
    try:
        # ── Step 1: Server-side YOLO detection (deterministic) ──────────
        yolo_detections = detect_objects(req.image)
        yolo_context = format_yolo_context(yolo_detections)

        # ── Step 2: Merge CV contexts (phone MediaPipe + server YOLO) ──
        cv_parts: list[str] = []
        if req.cv_context:
            cv_parts.append(req.cv_context)       # phone-side MediaPipe
        if yolo_context:
            cv_parts.append(yolo_context)          # server-side YOLO
        merged_cv_context = "\n".join(cv_parts) if cv_parts else None

        logger.info(
            "Scan pipeline: YOLO found %d objects, MediaPipe context %s",
            len(yolo_detections),
            "present" if req.cv_context else "absent",
        )

        # ── Step 3: Gemini analysis with full CV context ────────────────
        report = await get_visual_audit(
            image_base64=req.image,
            mime_type="image/jpeg",
            zone_type=req.zone_type,
            cv_context=merged_cv_context,
        )
        return ScanResponse(
            isValid=report.is_valid,
            zoneType=report.zone_type,
            inventory=report.inventory,
            violations=report.violations,
            computation=report.computation,
            recommendations=report.recommendations,
        )
    except ValueError as exc:
        logger.warning("Scan validation error: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        logger.error("Scan runtime error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("Scan unexpected error")
        raise HTTPException(status_code=500, detail=str(exc))
