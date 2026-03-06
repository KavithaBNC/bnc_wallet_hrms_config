@echo off
REM =============================================================================
REM Seed HRMS modules to Config DB - BNC Motors
REM Run from project root: scripts\run-seed-config-modules.bat
REM Or from backend: ..\scripts\run-seed-config-modules.bat
REM =============================================================================

cd /d "%~dp0"
set CONFIG_DB_URL=postgresql://postgres:Bncdb2026@bnc-db.czjz5u62pd3z.ap-south-1.rds.amazonaws.com:5432/Bnc_Configurator?schema=public^&sslmode=require

echo.
echo [1/2] Checking Config DB...
psql "%CONFIG_DB_URL%" -f "%~dp0check-config-db-before-seed.sql"
if errorlevel 1 (
  echo.
  echo Check failed. Is psql installed? Add PostgreSQL bin to PATH.
  pause
  exit /b 1
)

echo.
echo [2/2] Seeding HRMS modules...
psql "%CONFIG_DB_URL%" -f "%~dp0seed-hrms-modules-company-59-v2.sql"
if errorlevel 1 (
  echo.
  echo Seed failed. Check error above.
  pause
  exit /b 1
)

echo.
echo Done. HRMS modules seeded to Config DB.
pause
