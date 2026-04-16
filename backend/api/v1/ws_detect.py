"""WebSocket /api/v1/ws/detect — streaming YOLO-World detection.

Client sends binary JPEG frames, server responds with JSON detections.
Eliminates HTTP overhead per frame for real-time tracking (~3-5 FPS).
"""

import base64
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.yolo_service import detect_objects

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ws-detect"])


@router.websocket("/api/v1/ws/detect")
async def ws_detect(ws: WebSocket) -> None:
    await ws.accept()
    logger.info("WebSocket detection client connected")

    try:
        while True:
            raw = await ws.receive_bytes()

            b64 = base64.b64encode(raw).decode("ascii")
            detections = detect_objects(b64)

            payload = [
                {
                    "label": d.label,
                    "confidence": d.confidence,
                    "x": d.x,
                    "y": d.y,
                    "width": d.width,
                    "height": d.height,
                }
                for d in detections
            ]

            await ws.send_text(json.dumps({"objects": payload}))

    except WebSocketDisconnect:
        logger.info("WebSocket detection client disconnected")
    except Exception:
        logger.exception("WebSocket detection error")
        try:
            await ws.close(code=1011)
        except Exception:
            pass
