# Start the face-service container (Docker). Run from project root.
# Ensures face capture works when adding an employee with face.
# Prerequisite: Docker Desktop installed and running.

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

# Prefer Docker from PATH; if not found, try common install path
$docker = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $docker = "docker"
} else {
    $exe = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    if (Test-Path $exe) {
        $env:Path = "C:\Program Files\Docker\Docker\resources\bin;" + $env:Path
        $docker = "docker"
    }
}

if (-not $docker) {
    Write-Host "Docker not found. Install Docker Desktop and ensure 'docker' is in PATH." -ForegroundColor Red
    exit 1
}

Set-Location $projectRoot
Write-Host "Starting face-service container (port 8000)..." -ForegroundColor Cyan
docker compose up -d face-service
if ($LASTEXITCODE -ne 0) {
    Write-Host "If the image is not built yet, run first: docker compose build face-service" -ForegroundColor Yellow
    exit 1
}
Write-Host "Face service should be running. Check: http://localhost:8000/health" -ForegroundColor Green
Write-Host "Backend (localhost:5000) will use it for face encode when you add an employee with face." -ForegroundColor Gray
