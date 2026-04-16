@echo off
echo ==============================================
echo Pornire Visual Showroom Auditor
echo ==============================================

echo [1] Pornim Backend-ul (FastAPI) intr-o fereastra noua...
start "Backend (FastAPI)" cmd /k "python -m uvicorn backend.main:app --reload --port 8000"

echo [2] Pornim Frontend-ul (Vite) intr-o fereastra noua...
start "Frontend (Vite)" cmd /k "npm run dev"

echo.
echo Gata! S-au deschis doua ferestre de terminal:
echo - Una pentru Backend (asigura-te ca apare 'Application startup complete.')
echo - Una pentru Frontend (iti va da link-ul local, ex: http://localhost:5173/)
echo.
pause
