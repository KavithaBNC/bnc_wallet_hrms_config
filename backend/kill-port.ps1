<<<<<<< HEAD
# Fast port kill - no npx
$ports = @(5000, 5001, 5002)
foreach ($p in $ports) {
  $pids = (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
  foreach ($pid in $pids) {
    if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue; Write-Host "Killed PID $pid (port $p)" }
  }
}
Write-Host "Done."
=======
# Kill processes using port 5000
$port = 5000
Write-Host "🔍 Checking for processes using port $port..."

$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 }

if ($processes) {
    Write-Host "Found processes: $($processes -join ', ')"
    $processes | ForEach-Object {
        $processId = $_
        try {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Killing PID $processId ($($proc.ProcessName))..."
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Host "  Could not kill PID $processId"
        }
    }
    Write-Host "✅ Done! Port $port should now be free."
} else {
    Write-Host "ℹ️  No processes found using port $port"
}

# Wait a moment
Start-Sleep -Seconds 1

# Verify
$stillInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($stillInUse) {
    Write-Host "⚠️  Port $port is still in use. Try running as Administrator."
} else {
    Write-Host "✅ Port $port is now free!"
}
>>>>>>> hrms-main/main
