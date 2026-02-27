/**
 * Utility to check if port is in use and provide helpful error message
 */
export function checkPort(port: number): void {
  const { execSync } = require('child_process');
  
  try {
    // Try to find process using the port (Windows)
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
    if (result.trim()) {
      const lines = result.trim().split('\n');
      const pids = new Set<string>();
      
      lines.forEach((line: string) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 0) {
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(parseInt(pid))) {
            pids.add(pid);
          }
        }
      });
      
      if (pids.size > 0) {
        console.error(`\n❌ Port ${port} is already in use!`);
        console.error(`\nProcess IDs using port ${port}:`);
        Array.from(pids).forEach(pid => {
          console.error(`  - PID: ${pid}`);
        });
        console.error(`\n💡 To fix this, run one of these commands:`);
        console.error(`   Option 1: Kill the process`);
        Array.from(pids).forEach(pid => {
          console.error(`     taskkill /PID ${pid} /F`);
        });
        console.error(`\n   Option 2: Change the port in .env file:`);
        console.error(`     PORT=5001`);
        console.error(`\n   Option 3: Find and stop the process manually:`);
        console.error(`     Get-Process -Id ${Array.from(pids)[0]} | Stop-Process -Force`);
        process.exit(1);
      }
    }
  } catch (error) {
    // Port might not be in use, or command failed - continue
  }
}
