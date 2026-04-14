"""YOLO-World server-side open-vocabulary object detection.

Unlike standard YOLO (80 COCO classes), YOLO-World can detect ANY object
you describe in text — no retraining needed. We define showroom-specific
classes here and the model finds them by understanding language.

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

# ── Showroom-specific classes (open-vocabulary) ──────────────────────────────

SHOWROOM_CLASSES = [
    # Persoane
    "person",
    # Obiecte personale (neconforme)
    "cell phone",
    "headphones",
    "earbuds",
    "personal bag",
    "backpack",
    "handbag",
    "water bottle",
    "coffee cup",
    "coffee cup with lid",
    "dirty cup",
    "food container",
    "lunch bag",
    "wallet",
    "sunglasses",
    "jacket on chair",
    # Documente & birou
    "paper document",
    "receipt",
    "sticky note",
    "folder",
    "open folder",
    "stack of papers",
    "crumpled paper",
    "pen",
    "pencil",
    "marker",
    "business card",
    "price tag",
    # Echipament standard
    "computer monitor",
    "laptop",
    "keyboard",
    "mouse",
    "printer",
    "POS terminal",
    "barcode scanner",
    "desk lamp",
    "office chair",
    # Mobilier & context
    "desk",
    "shelf",
    "cabinet",
    "trash can",
    "potted plant",
    "open drawer",
    # Cabluri & accesorii
    "cable",
    "usb cable",
    "charger",
    "power strip",
    "keys",
    "scissors",
    "tape dispenser",
    "stapler",
    # Materiale
    "book",
    "catalog",
    "promotional flyer",
    "plastic bag",
    "umbrella",
]

# ── Model singleton ─────────────────────────────────────────────────────────

_model: YOLO | None = None


def _get_model() -> YOLO:
    """Lazy-load YOLO-World small — open-vocabulary detection."""
    global _model
    if _model is None:
        logger.info("Loading YOLO-World model (first request)…")
        _model = YOLO("yolov8s-worldv2.pt")
        _model.set_classes(SHOWROOM_CLASSES)
        logger.info(
            "YOLO-World loaded with %d custom classes.", len(SHOWROOM_CLASSES)
        )
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
    """Run YOLO-World on a base64-encoded JPEG and return normalised detections."""

    raw_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    img_w, img_h = img.size

    model = _get_model()
    results = model(img, verbose=False, conf=0.15)

    detections: list[YoloDetection] = []
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            label = SHOWROOM_CLASSES[cls_id] if cls_id < len(SHOWROOM_CLASSES) else f"class_{cls_id}"
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

    logger.info("YOLO-World detected %d objects", len(detections))
    return detections


# ── Formatter — builds the text block that gets injected into Gemini ─────────

def format_yolo_context(detections: list[YoloDetection]) -> str:
    """Format YOLO-World detections as a text block for the Gemini prompt."""
    if not detections:
        return ""

    lines = [
        f"- {d.label} ({round(d.confidence * 100)}%) "
        f"la [{d.x:.2f}, {d.y:.2f}, {d.width:.2f}, {d.height:.2f}]"
        for d in detections
    ]

    return (
        "\n\n## OBIECTE DETECTATE PE SERVER (YOLO-World — detecție open-vocabulary, de încredere):\n"
        + "\n".join(lines)
        + "\nAceste detecții sunt de ÎNALTĂ PRECIZIE. Folosește-le ca sursă primară de localizare."
        + "\nClasele detectate includ obiecte specifice showroom-ului (documente, telefoane, "
        + "căni cafea, dosare, echipament birou etc.) — nu doar cele 80 de clase generice COCO."
    )
