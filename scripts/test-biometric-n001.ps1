# Test biometric device GET and POST for employee N001
# Usage: .\scripts\test-biometric-n001.ps1 [-BaseUrl "http://localhost:5001"] [-Serial "CQZ7224460246"]

param(
    [string]$BaseUrl = "http://localhost:5001",
    [string]$Serial = "CQZ7224460246"
)

$Cdata = "$BaseUrl/iclock/cdata"
$CdataAspx = "$BaseUrl/iclock/cdata.aspx"

Write-Host "=== Biometric device test for N001 ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host "Serial:   $Serial"
Write-Host ""

Write-Host "1. GET handshake" -ForegroundColor Yellow
$r1 = Invoke-WebRequest -Uri "$Cdata`?SN=$Serial&options=all" -UseBasicParsing
$r1.Content -split "`n" | Select-Object -First 5
Write-Host ""

Write-Host "2. POST punch (N001 IN) - tab-separated (eSSL format)" -ForegroundColor Yellow
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$body = "N001`t$ts`t0`t4`t0`t`t`t0`t0"
$r2 = Invoke-WebRequest -Uri "$CdataAspx`?SN=$Serial&table=ATTLOG&Stamp=9999" `
    -Method POST -ContentType "text/plain" -Body $body -UseBasicParsing
Write-Host "   Response: $($r2.Content)"
Write-Host "   Sent: N001 IN at $ts"
Write-Host ""

Write-Host "3. POST punch (N001 OUT) - key=value format" -ForegroundColor Yellow
$ts2 = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$body2 = "USERID=N001`nTIMESTAMP=$ts2`nSTATUS=1`nSERIALNO=$Serial"
$r3 = Invoke-WebRequest -Uri "$Cdata`?SN=$Serial" `
    -Method POST -ContentType "text/plain" -Body $body2 -UseBasicParsing
Write-Host "   Response: $($r3.Content)"
Write-Host "   Sent: N001 OUT at $ts2"
Write-Host ""

Write-Host "4. GET getrequest (device polls)" -ForegroundColor Yellow
$r4 = Invoke-WebRequest -Uri "$BaseUrl/iclock/getrequest.aspx?SN=$Serial" -UseBasicParsing
Write-Host "   Response: $($r4.Content)"
Write-Host ""

Write-Host "Done. Check attendance_logs and attendance_punches in DB." -ForegroundColor Green
