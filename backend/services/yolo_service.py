"""YOLOv11 server-side object detection.

Runs deterministic inference on every scan image before Gemini,
providing pixel-level detection that complements the phone's MediaPipe.
The model is loaded once at import time and reused across requests.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import NamedTuple

from PIL import Image
from ultralytics import YOLO

logger = logging.getLogger(__name__)

# ── Model singleton ─────────────────────────────────────────────────────────

_model: YOLO | None = None


def _get_model() -> YOLO:
    """Lazy-load YOLOv11n (nano) — fast enough for per-request inference."""
    global _model
    if _model is None:
        logger.info("Loading YOLOv11n model (first request)…")
        _model = YOLO("yolo11n.pt")
        logger.info("YOLOv11n model loaded.")
    return _model


# ── Public types ─────────────────────────────────────────────────────────────

class YoloDetection(NamedTuple):
    label: str
    confidence: float
    x: float       # normalised 0-1
    y: float       # normalised 0-1
    width: float   # normalised 0-1
    height: float  # normalised 0-1


# ── Core function ────────────────────────────────────────────────────────────

def detect_objects(image_base64: str) -> list[YoloDetection]:
    """Run YOLOv11 on a base64-encoded JPEG and return normalised detections."""

    raw_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    img_w, img_h = img.size

    model = _get_model()
    results = model(img, verbose=False)

    detections: list[YoloDetection] = []
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            conf = float(box.conf[0])

            # xyxy → normalised xywh
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            nx = x1 / img_w
            ny = y1 / img_h
            nw = (x2 - x1) / img_w
            nh = (y2 - y1) / img_h

            detections.append(YoloDetection(
                label=label,
                confidence=round(conf, 3),
                x=round(nx, 4),
                y=round(ny, 4),
                width=round(nw, 4),
                height=round(nh, 4),
            ))

    logger.info("YOLO detected %d objects", len(detections))
    return detections


# ── Formatter — builds the text block that gets injected into Gemini ─────────

def format_yolo_context(detections: list[YoloDetection]) -> str:
    """Format YOLO detections as a text block for the Gemini prompt."""
    if not detections:
        return ""

    lines = [
        f"- {d.label} ({round(d.confidence * 100)}%) "
        f"la [{d.x:.2f}, {d.y:.2f}, {d.width:.2f}, {d.height:.2f}]"
        for d in detections
    ]

    return (
        "\n\n## OBIECTE DETECTATE PE SERVER (YOLOv11 — detecție deterministă, de încredere):\n"
        + "\n".join(lines)
        + "\nAceste detecții sunt de ÎNALTĂ PRECIZIE. Folosește-le ca sursă primară de localizare."
    )
