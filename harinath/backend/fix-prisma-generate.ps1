# Fix EPERM when running prisma generate (file locked by backend)
# 1. Stop processes on port 5000 (backend) so Prisma DLL is released
# 2. Run prisma generate
# Run from backend folder: .\fix-prisma-generate.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Fix Prisma EPERM (query_engine-windows.dll.node locked)" -ForegroundColor Cyan
Write-Host ""

# Free port 5000 so backend releases Prisma files
$port = 5000
$pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 }
if ($pids) {
    Write-Host "Stopping backend on port $port (PIDs: $($pids -join ', ')) so Prisma files can be updated..."
    $pids | ForEach-Object {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    Write-Host "Done. Running prisma generate..." -ForegroundColor Green
} else {
    Write-Host "No process on port $port. Running prisma generate..." -ForegroundColor Green
}

npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "prisma generate failed. Try: close all terminals running npm run dev, then run: npx prisma generate" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Prisma client generated. Start the backend with: npm run dev" -ForegroundColor Green
