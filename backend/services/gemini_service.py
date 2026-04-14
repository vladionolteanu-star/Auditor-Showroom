"""Server-side Gemini integration — ported from services/geminiService.ts.

API key stays here, never reaches the browser.
"""

from __future__ import annotations

import json
import os
import re

import google.generativeai as genai

from backend.models.schemas import (
    CalculatedScore,
    ComplianceReport,
    WorkspaceInventory,
    WorkspaceViolation,
    ZoneType,
)
from backend.services.ai_validator import sanitize_ai_response, validate_ai_response
from backend.services.prompt_builder import build_audit_prompt
from backend.services.scoring_engine import calculate_score


def _configure_genai() -> None:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is not set")
    genai.configure(api_key=api_key)


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
    """Run Gemini compliance audit — equivalent of getVisualAudit() in TS."""

    _configure_genai()

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            top_k=1,
            top_p=0.1,
            candidate_count=1,
        ),
    )

    base_prompt = build_audit_prompt(zone_type)
    prompt = base_prompt + cv_context if cv_context else base_prompt

    image_part = {"mime_type": mime_type, "data": image_base64}

    response = await model.generate_content_async(
        [prompt, "--- Imagine live de analizat ---", image_part]
    )

    raw_text = response.text
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
