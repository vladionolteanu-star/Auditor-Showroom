"""Pydantic models — mirrors types.ts for full API contract."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────────

class ZoneType(str, Enum):
    CASIERIE = "casierie"
    BIROU_CONSILIER = "birou_consilier"


class Severity(str, Enum):
    CRITICA = "CRITICĂ"
    MARE = "Mare"
    MEDIE = "Medie"
    MICA = "Mică"


# ── Domain models ────────────────────────────────────────────────────────────

class BoundingBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(ge=0, le=1)
    height: float = Field(ge=0, le=1)


class WorkspaceViolation(BaseModel):
    description: str
    severity: Severity
    bounding_box: Optional[BoundingBox] = Field(default=None, alias="boundingBox")

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class WorkspaceInventory(BaseModel):
    disorder_score: int = Field(ge=0, le=10)
    has_personal_items: bool
    has_document_clutter: bool
    has_clear_workspace: bool


class CalculatedScore(BaseModel):
    final_score: int = Field(alias="finalScore")
    grade: str
    penalties: list[str]
    color: str

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class ComplianceReport(BaseModel):
    is_valid: bool = Field(alias="isValid")
    zone_type: ZoneType = Field(alias="zoneType")
    inventory: WorkspaceInventory
    violations: list[WorkspaceViolation]
    computation: CalculatedScore
    recommendations: list[str]

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


# ── Request / Response ───────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    image: str = Field(description="Base64-encoded JPEG image")
    zone_type: ZoneType = Field(alias="zoneType")
    cv_context: Optional[str] = Field(default=None, alias="cvContext")

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class ScanResponse(BaseModel):
    """Returned to frontend — identical shape to the old getVisualAudit result."""
    is_valid: bool = Field(alias="isValid")
    zone_type: ZoneType = Field(alias="zoneType")
    inventory: WorkspaceInventory
    violations: list[WorkspaceViolation]
    computation: CalculatedScore
    recommendations: list[str]

    model_config = {"populate_by_name": True, "serialize_by_alias": True}
