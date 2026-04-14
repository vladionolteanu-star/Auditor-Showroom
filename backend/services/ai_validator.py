"""AI response validation and sanitization — ported from services/aiValidator.ts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def validate_ai_response(data: dict[str, Any]) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    inventory = data.get("inventory", {})

    # 1. disorder_score
    ds = inventory.get("disorder_score")
    if ds is None:
        errors.append("Missing inventory field: disorder_score")
    elif not isinstance(ds, (int, float)) or ds < 0 or ds > 10:
        errors.append(f"disorder_score should be 0-10, got {ds}")

    # 2. Boolean fields
    for f in ("has_personal_items", "has_document_clutter", "has_clear_workspace"):
        if not isinstance(inventory.get(f), bool):
            warnings.append(f"{f} should be boolean, got {type(inventory.get(f)).__name__}")

    # 3. Deviations
    devs = data.get("raw_deviations")
    if not isinstance(devs, list):
        errors.append("raw_deviations should be an array")
    else:
        for i, dev in enumerate(devs):
            if not dev.get("description") or not isinstance(dev.get("description"), str):
                errors.append(f"Deviation {i}: missing or invalid description")

            bb = dev.get("boundingBox")
            if bb:
                for key in ("x", "y", "width", "height"):
                    v = bb.get(key)
                    if not isinstance(v, (int, float)) or v < 0 or v > 1:
                        errors.append(f"Deviation {i}: boundingBox.{key} must be in [0,1]")
                w = bb.get("width", 0)
                h = bb.get("height", 0)
                if isinstance(w, (int, float)) and isinstance(h, (int, float)):
                    if w < 0.01 or h < 0.01:
                        warnings.append(f"Deviation {i}: bounding box very small")

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


def sanitize_ai_response(data: dict[str, Any]) -> dict[str, Any]:
    """Clamp and coerce raw AI output into safe ranges."""
    import copy
    sanitized = copy.deepcopy(data)

    inv = sanitized.get("inventory", {})
    inv["disorder_score"] = max(0, min(10, round(float(inv.get("disorder_score", 0)))))
    inv["has_personal_items"] = bool(inv.get("has_personal_items"))
    inv["has_document_clutter"] = bool(inv.get("has_document_clutter"))
    inv["has_clear_workspace"] = bool(inv.get("has_clear_workspace"))
    sanitized["inventory"] = inv

    devs = sanitized.get("raw_deviations", [])
    if isinstance(devs, list):
        for dev in devs:
            bb = dev.get("boundingBox")
            if bb:
                bb["x"] = max(0.0, min(1.0, float(bb.get("x", 0))))
                bb["y"] = max(0.0, min(1.0, float(bb.get("y", 0))))
                bb["width"] = max(0.0, min(1.0 - bb["x"], float(bb.get("width", 0))))
                bb["height"] = max(0.0, min(1.0 - bb["y"], float(bb.get("height", 0))))
            if not dev.get("severity"):
                dev["severity"] = "Medie"
        sanitized["raw_deviations"] = devs

    return sanitized
