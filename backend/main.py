"""FastAPI application — entry point for the backend server."""

from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env explicitly (don't rely on cwd) and override any stale shell env
_ENV_FILE = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_ENV_FILE, override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1.scan import router as scan_router
from backend.api.v1.detect import router as detect_router
from backend.api.v1.ws_detect import router as ws_detect_router

app = FastAPI(
    title="Visual Showroom Auditor API",
    version="1.0.0",
)

# CORS — permissive for dev (internal tool, not public-facing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router)
app.include_router(detect_router)
app.include_router(ws_detect_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
