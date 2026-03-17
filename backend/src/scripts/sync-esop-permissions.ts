import { permissionService } from '../services/permission.service';

async function main() {
  const result = await permissionService.syncAppModulePermissions();
  console.log(`✅ Synced permissions. Created ${result.created} new permission records.`);
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
