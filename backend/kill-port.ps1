# Fast port kill - no npx
$ports = @(5000, 5001, 5002)
foreach ($p in $ports) {
  $pids = (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
  foreach ($pid in $pids) {
    if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue; Write-Host "Killed PID $pid (port $p)" }
  }
}
Write-Host "Done."
