# HRMS Portal - Run script
# Run this in PowerShell from the project root (bnc_wallet_hrms folder).
# IMPORTANT: If you get "PrismaClient" or EPERM errors, run fix-prisma-generate.ps1 first
# in a terminal *outside* Cursor (e.g. Windows PowerShell / Windows Terminal).
# If you use a proxy, the script clears it for Prisma; set your proxy again after if needed.

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

# Clear proxy so Prisma can download engines (optional - remove if you don't use proxy)
$env:HTTP_PROXY = ''
$env:HTTPS_PROXY = ''
$env:http_proxy = ''
$env:https_proxy = ''

Write-Host "=== 1. Backend: Prisma generate ===" -ForegroundColor Cyan
Set-Location "$projectRoot\backend"
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "If prisma:generate failed with EPERM (rename): close other terminals, stop any running backend, then run this script again. You can also try running PowerShell as Administrator." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== 2. Backend: Start dev server (port 5000) ===" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; npm run dev"

Start-Sleep -Seconds 3

Write-Host "`n=== 3. Frontend: Start dev server (port 3000) ===" -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; npm run dev"

Write-Host "`nBackend: http://localhost:5000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "`nFor face capture (add employee with face): run .\run-face-service.ps1 in another terminal (Docker required)." -ForegroundColor Gray
Write-Host "Two new terminal windows were opened. Close them to stop the servers." -ForegroundColor Gray
