# Fix "Module '@prisma/client' has no exported member 'PrismaClient'" error
# Run this in Windows PowerShell or Terminal *outside* Cursor (right-click folder -> Open in Terminal, or Win+R -> powershell).
# Cursor's terminal can block Prisma's engine (.exe) with EPERM.

$ErrorActionPreference = "Stop"
$backend = $PSScriptRoot
if (Test-Path "$PSScriptRoot\backend") { $backend = "$PSScriptRoot\backend" }

# Clear proxy so Prisma can download engines if needed
$env:HTTP_PROXY = ''
$env:HTTPS_PROXY = ''
$env:http_proxy = ''
$env:https_proxy = ''

Write-Host "Running Prisma generate in: $backend" -ForegroundColor Cyan
Set-Location $backend
npm run prisma:generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nPrisma client generated successfully. You can now run the backend (npm run dev)." -ForegroundColor Green
} else {
    Write-Host "`nIf you see EPERM: close other terminals, stop the backend, then run this script again. Try running PowerShell as Administrator if needed." -ForegroundColor Yellow
    exit 1
}
