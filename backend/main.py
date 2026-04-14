"""FastAPI application — entry point for the backend server."""

from dotenv import load_dotenv

load_dotenv()  # reads backend/.env (or project root .env)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1.scan import router as scan_router

app = FastAPI(
    title="Visual Showroom Auditor API",
    version="1.0.0",
)

# CORS — allow the Vite dev server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev
        "http://localhost:4173",   # Vite preview
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(scan_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
