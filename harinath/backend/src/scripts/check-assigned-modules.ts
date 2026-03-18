/**
 * Check assigned modules for a user (superadmin@bncmotors.com / ORG_ADMIN)
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/check-assigned-modules.ts
 * Requires: Backend running (or set API_BASE), Configurator at CONFIGURATOR_API_URL
 */

const API_BASE = process.env.API_BASE || 'http://localhost:5001';
const EMAIL = 'superadmin@bncmotors.com';
const PASSWORD = 'SuperAdmin@59';

async function main() {
  console.log('=== Checking Assigned Modules for', EMAIL, '===\n');

  // 1. Login via Configurator
  console.log('1. Logging in via Configurator...');
  const loginRes = await fetch(`${API_BASE}/api/v1/auth/configurator/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: EMAIL,
      password: PASSWORD,
      company_name_or_code: 'Bnc Motors',
    }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error('Login failed:', loginRes.status, err);
    process.exit(1);
  }

  const loginData = (await loginRes.json()) as { data?: { user?: any; tokens?: any; modules?: any[] } };
  const { user, tokens, modules } = loginData.data || {};

  console.log('   User:', user?.email, '| Role:', user?.role);
  console.log('   Org:', user?.employee?.organization?.name || 'N/A');
  console.log('');

  // 2. Configurator-assigned modules (from Config DB project_modules + role_module_permissions)
  console.log('2. Configurator Assigned Modules (Config DB → role_module_permissions):');
  if (modules?.length) {
    modules.forEach((m: { id?: number; name?: string; code?: string }) => {
      console.log(`   - ${m.name} (code: ${m.code}, id: ${m.id})`);
    });
    console.log(`   Total: ${modules.length} modules\n`);
  } else {
    console.log('   (None or Configurator returned empty list)\n');
  }

  // 3. HRMS permissions (role_permissions - used for sidebar visibility)
  const accessToken = tokens?.accessToken;
  if (accessToken) {
    console.log('3. HRMS Role Permissions (sidebar visibility):');
    const permRes = await fetch(`${API_BASE}/api/v1/permissions/role-permissions/user/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (permRes.ok) {
      const permData = (await permRes.json()) as { data?: { permissions?: { resource?: string }[] } };
      const perms = permData.data?.permissions || [];
      const resources = [...new Set(perms.map((p) => p.resource).filter(Boolean))].sort() as string[];
      resources.forEach((r) => console.log(`   - ${r}`));
      console.log(`   Total: ${resources.length} resources with permissions\n`);
    } else {
      console.log('   (Could not fetch -', permRes.status, ')\n');
    }
  }

  // 4. Org modules (organization_modules - if used)
  const orgId = user?.employee?.organizationId || user?.employee?.organization?.id;
  if (orgId && accessToken) {
    console.log('4. Organization Modules (organization_modules for org):');
    const orgModRes = await fetch(`${API_BASE}/api/v1/organizations/${orgId}/modules`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (orgModRes.ok) {
      const orgModData = (await orgModRes.json()) as { data?: { modules?: string[] } };
      const orgMods = orgModData.data?.modules || [];
      orgMods.forEach((m: string) => console.log(`   - ${m}`));
      console.log(`   Total: ${orgMods.length} modules\n`);
    } else {
      console.log('   (Could not fetch -', orgModRes.status, ')\n');
    }
  }

  console.log('=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
