"""Server-side Gemini integration using google.genai Client (SDK 0.8+).

API key stays here, never reaches the browser.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re

from google import genai

from backend.models.schemas import (
    ComplianceReport,
    WorkspaceInventory,
    WorkspaceViolation,
    ZoneType,
)
from backend.services.ai_validator import sanitize_ai_response, validate_ai_response
from backend.services.prompt_builder import build_audit_prompt
from backend.services.scoring_engine import calculate_score

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-2.5-flash"

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set")
        _client = genai.Client(api_key=api_key)
        logger.info("Gemini client initialized (model=%s)", MODEL_NAME)
    return _client


def _extract_json(text: str) -> dict | None:
    cleaned = re.sub(r"```json|```", "", text)
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1:
        try:
            return json.loads(cleaned[first : last + 1])
        except json.JSONDecodeError:
            return None
    return None


async def get_visual_audit(
    image_base64: str,
    mime_type: str,
    zone_type: ZoneType,
    cv_context: str | None = None,
) -> ComplianceReport:
    """Run Gemini compliance audit."""

    client = _get_client()

    base_prompt = build_audit_prompt(zone_type)
    prompt = base_prompt + cv_context if cv_context else base_prompt

    image_bytes = base64.b64decode(image_base64)

    logger.info(
        "Sending request to Gemini (model=%s, zone=%s, image=%d bytes)",
        MODEL_NAME, zone_type, len(image_bytes),
    )

    image_part = genai.types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = await client.aio.models.generate_content(
        model=MODEL_NAME,
        contents=[prompt, "--- Imagine live de analizat ---", image_part],
        config=genai.types.GenerateContentConfig(
            temperature=0.1,
            top_k=1,
            top_p=0.1,
            candidate_count=1,
        ),
    )

    raw_text = response.text
    logger.info("Gemini response received (%d chars)", len(raw_text))
    raw_data = _extract_json(raw_text)

    if raw_data is None:
        raise ValueError("Nu s-a putut genera un raport valid.")

    validation = validate_ai_response(raw_data)
    if not validation.is_valid:
        raise ValueError(f"Validare esuata: {', '.join(validation.errors)}")

    sanitized = sanitize_ai_response(raw_data)

    inventory = WorkspaceInventory(**sanitized["inventory"])
    computation = calculate_score(inventory)

    violations = [
        WorkspaceViolation(**dev) for dev in sanitized.get("raw_deviations", [])
    ]

    return ComplianceReport(
        isValid=True,
        zoneType=zone_type,
        inventory=inventory,
        violations=violations,
        computation=computation,
        recommendations=sanitized.get("recommendations", []),
    )
