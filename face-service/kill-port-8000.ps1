# Free port 8000 (face-service). Run from face-service folder or project root.
$port = 8000
Write-Host "Checking for processes using port $port..."

$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 }

if ($processes) {
    Write-Host "Found PIDs: $($processes -join ', ')"
    $processes | ForEach-Object {
        $processId = $_
        try {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Stopping PID $processId ($($proc.ProcessName))..."
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Host "  Could not stop PID $processId"
        }
    }
    Write-Host "Done. Port $port should be free."
} else {
    Write-Host "No process using port $port."
}
