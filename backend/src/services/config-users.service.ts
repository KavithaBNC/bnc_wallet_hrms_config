/**
 * Config Users Service — Direct Config DB access (replaces RAG API user calls)
 * Replaces: POST /api/v1/users/list, POST /api/v1/users/add,
 *           PUT /api/v1/users/, DELETE /api/v1/users/,
 *           PUT /api/v1/users/separate,
 *           POST /api/v1/users/upload-excel,
 *           GET /api/v1/users/download/employee_import_template
 */

import bcrypt from 'bcryptjs';
import { configPrisma } from '../utils/config-prisma';
import { AppError } from '../middlewares/errorHandler';

const BCRYPT_ROUNDS = 10;

export interface ConfigUserCreateResult {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  encrypted_password: string | null;
  code: string | null;
}

class ConfigUsersService {
  /**
   * List users from Config DB
   * Replaces: POST /api/v1/users/list
   */
  async getUsers(companyId: number): Promise<any[]> {
    try {
      const users = await configPrisma.users.findMany({
        where: { company_id: companyId },
        include: {
          departments: { select: { id: true, name: true, code: true } },
          companies: { select: { id: true, name: true, code: true } },
          user_roles: { include: { roles: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: { first_name: 'asc' },
      });

      // Collect unique sub_department_ids, cost_centre_ids, manager_ids for batch fetch
      const subDeptIds = new Set<number>();
      const ccIds = new Set<number>();
      const managerIds = new Set<number>();
      for (const u of users) {
        if (u.sub_department_id) subDeptIds.add(u.sub_department_id);
        if (u.cost_centre_id) ccIds.add(u.cost_centre_id);
        if (u.manager_id) managerIds.add(u.manager_id);
      }

      // Batch fetch sub_departments, cost_centres, managers
      const [subDepts, costCentres, managers] = await Promise.all([
        subDeptIds.size > 0
          ? configPrisma.sub_departments.findMany({ where: { id: { in: Array.from(subDeptIds) } }, select: { id: true, name: true, code: true } })
          : [],
        ccIds.size > 0
          ? configPrisma.cost_centres.findMany({ where: { id: { in: Array.from(ccIds) } }, select: { id: true, name: true, code: true } })
          : [],
        managerIds.size > 0
          ? configPrisma.users.findMany({ where: { id: { in: Array.from(managerIds) } }, select: { id: true, first_name: true, last_name: true, email: true, code: true } })
          : [],
      ]);

      const subDeptMap = new Map(subDepts.map((s: any) => [s.id, s]));
      const ccMap = new Map(costCentres.map((c: any) => [c.id, c]));
      const managerMap = new Map(managers.map((m: any) => [m.id, m]));

      return users.map((u) => {
        const primaryRole = u.user_roles?.[0]?.roles ?? null;
        const managerUser = u.manager_id ? managerMap.get(u.manager_id) : null;
        return {
          id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          full_name: `${u.first_name} ${u.last_name}`.trim(),
          phone: u.phone,
          code: u.code,
          password: u.login_pin ?? u.encrypted_password,
          company_id: u.company_id,
          role_id: u.role_id,
          department_id: u.department_id,
          sub_department_id: u.sub_department_id,
          cost_centre_id: u.cost_centre_id,
          manager_id: u.manager_id,
          branch_id: u.branch_id,
          is_active: u.is_active,
          department: u.departments ? { id: u.departments.id, name: u.departments.name, code: u.departments.code } : null,
          sub_department: u.sub_department_id ? (subDeptMap.get(u.sub_department_id) ?? null) : null,
          cost_centre: u.cost_centre_id ? (ccMap.get(u.cost_centre_id) ?? null) : null,
          project_role: primaryRole ? { id: primaryRole.id, name: primaryRole.name, code: primaryRole.code } : null,
          reporting_manager: managerUser
            ? { id: managerUser.id, name: `${managerUser.first_name} ${managerUser.last_name}`.trim(), email: managerUser.email, code: managerUser.code }
            : null,
          company: u.companies ? { id: u.companies.id, name: u.companies.name, code: u.companies.code } : null,
          created_at: u.created_at,
          updated_at: u.updated_at,
        };
      });
    } catch (err: any) {
      console.error('[configUsersService.getUsers] Error:', err.message);
      throw new AppError('Failed to fetch users from Config DB', 500);
    }
  }

  /**
   * Create user in Config DB
   * Replaces: POST /api/v1/users/add
   */
  async createUser(data: {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company_id: number;
    project_id?: number;
    role_id?: number;
    cost_centre_id?: number;
    department_id?: number;
    sub_department_id?: number;
    branch_id?: number;
    password: string;
    username?: string;
    manager_id?: number | null;
    code?: string;
    created_by?: number | null;
    created_by_name?: string | null;
  }): Promise<ConfigUserCreateResult> {
    try {
      // Check for duplicate email in same company
      const existing = await configPrisma.users.findFirst({
        where: { email: { equals: data.email, mode: 'insensitive' }, company_id: data.company_id },
      });
      if (existing) {
        throw new AppError(`User with email ${data.email} already exists in this company`, 400);
      }

      // Hash password
      const encryptedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

      const createData: any = {
        email: data.email.toLowerCase(),
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        phone: data.phone ?? null,
        password: encryptedPassword,
        encrypted_password: encryptedPassword,
        login_pin: data.password,   // store plain-text password for admin display
        company_id: data.company_id,
        role_id: data.role_id ? [data.role_id] : [],
        is_active: true,
        code: data.code ?? null,
      };
      // FK fields — only set if non-zero
      if (data.department_id && data.department_id > 0) createData.department_id = data.department_id;
      if (data.sub_department_id && data.sub_department_id > 0) createData.sub_department_id = data.sub_department_id;
      if (data.cost_centre_id && data.cost_centre_id > 0) createData.cost_centre_id = data.cost_centre_id;
      // branch_id — best-effort (FK may fail if branches.id is BigInt and value is out of range)
      if (data.branch_id && data.branch_id > 0) createData.branch_id = data.branch_id;
      if (data.manager_id != null) createData.manager_id = data.manager_id;
      // project_id stored directly on users row
      if (data.project_id && data.project_id > 0) {
        createData.project_id = data.project_id;
        createData.project_ids = String(data.project_id);
      }
      // audit fields
      if (data.created_by != null) createData.created_by = data.created_by;
      if (data.created_by_name) createData.created_by_name = data.created_by_name;

      let user;
      try {
        user = await configPrisma.users.create({ data: createData });
      } catch (createErr: any) {
        // If branch_id FK fails, retry without it
        if (createData.branch_id && createErr.message?.includes('branch')) {
          console.warn(`[configUsersService.createUser] branch_id ${createData.branch_id} FK failed, retrying without it`);
          delete createData.branch_id;
          user = await configPrisma.users.create({ data: createData });
        } else {
          throw createErr;
        }
      }

      // Assign role via user_roles junction table if role_id provided
      if (data.role_id && data.role_id > 0) {
        await configPrisma.user_roles.create({
          data: { user_id: user.id, role_id: data.role_id },
        }).catch(() => { /* role assignment is best-effort */ });
      }

      // Assign project role if project_id provided
      if (data.project_id && data.project_id > 0 && data.role_id) {
        await configPrisma.user_project_roles.create({
          data: {
            user_id: user.id,
            project_id: data.project_id,
            role_id: data.role_id,
            company_id: data.company_id,
            is_active: true,
          },
        }).catch(() => { /* project role assignment is best-effort */ });
      }

      console.log('[configUsersService.createUser] OK — id:', user.id, 'email:', user.email);
      return {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        encrypted_password: user.encrypted_password,
        code: user.code,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error('[configUsersService.createUser] FAILED:', err.message);
      throw new AppError(err.message || 'Failed to create user in Config DB', 500);
    }
  }

  /**
   * Update user in Config DB
   * Replaces: PUT /api/v1/users/
   */
  async updateUser(
    userId: number,
    data: {
      email?: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      company_id?: number;
      role_id?: number;
      password?: string;
      is_active?: boolean;
      department_id?: number | null;
      cost_centre_id?: number | null;
      sub_department_id?: number | null;
      manager_id?: number | null;
      code?: string;
    }
  ): Promise<{ id: number; email: string; first_name: string; last_name: string }> {
    try {
      const updateData: any = {};
      if (data.email != null) updateData.email = data.email.toLowerCase();
      if (data.first_name != null) updateData.first_name = data.first_name;
      if (data.last_name != null) updateData.last_name = data.last_name;
      if (data.phone != null) updateData.phone = data.phone;
      if (data.is_active != null) updateData.is_active = data.is_active;
      if (data.code != null) updateData.code = data.code;
      if (data.department_id !== undefined) updateData.department_id = data.department_id;
      if (data.cost_centre_id !== undefined) updateData.cost_centre_id = data.cost_centre_id;
      if (data.sub_department_id !== undefined) updateData.sub_department_id = data.sub_department_id;
      if (data.manager_id !== undefined) updateData.manager_id = data.manager_id;

      if (data.password) {
        const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
        updateData.password = hash;
        updateData.encrypted_password = hash;
      }

      if (data.role_id != null) {
        updateData.role_id = [data.role_id];
      }

      const user = await configPrisma.users.update({
        where: { id: userId },
        data: updateData,
      });

      return { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name };
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw new AppError(`User with id ${userId} not found`, 404);
      }
      console.error('[configUsersService.updateUser] FAILED:', err.message);
      throw new AppError(err.message || 'Failed to update user in Config DB', 500);
    }
  }

  /**
   * Soft-delete user in Config DB (set is_active = false)
   * Replaces: DELETE /api/v1/users/
   */
  async deleteUser(userId: number): Promise<void> {
    try {
      await configPrisma.users.update({
        where: { id: userId },
        data: { is_active: false, deleted_at: new Date() },
      });
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw new AppError(`User with id ${userId} not found`, 404);
      }
      throw new AppError(err.message || 'Failed to delete user in Config DB', 500);
    }
  }

  /**
   * Separate user in Config DB
   * Replaces: PUT /api/v1/users/separate
   */
  async separateUser(data: {
    company_id?: number;
    user_id: number;
    remarks: string;
    separation_type: string;
  }): Promise<any> {
    try {
      const user = await configPrisma.users.update({
        where: { id: data.user_id },
        data: {
          is_active: false,
          remarks: data.remarks,
          separation_type: data.separation_type,
        },
      });
      return { id: user.id, email: user.email, is_active: user.is_active };
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw new AppError(`User with id ${data.user_id} not found`, 404);
      }
      throw new AppError(err.message || 'Failed to separate user in Config DB', 500);
    }
  }

  /**
   * Bulk create users in Config DB (replaces upload-excel API call)
   * Replaces: POST /api/v1/users/upload-excel
   *
   * Instead of sending an Excel file to the RAG API, we directly create users
   * row-by-row in the Config DB.
   */
  async bulkCreateUsers(
    rows: Array<{
      email: string;
      first_name: string;
      last_name: string;
      phone?: string;
      password: string;
      code?: string;
      department_id?: number;
      sub_department_id?: number;
      cost_centre_id?: number;
      branch_id?: number;
      manager_id?: number | null;
      /** Per-row Config role; falls back to `defaultRoleId` when missing or invalid */
      role_id?: number;
      created_by?: number | null;
    }>,
    companyId: number,
    projectId: number,
    defaultRoleId: number
  ): Promise<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    results: Array<{
      row: number;
      email: string;
      status: string;
      message: string;
      user?: ConfigUserCreateResult;
    }>;
  }> {
    const results: Array<{ row: number; email: string; status: string; message: string; user?: ConfigUserCreateResult }> = [];
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const roleIdForRow =
        row.role_id && row.role_id > 0 ? row.role_id : defaultRoleId;
      try {
        // Check if user already exists
        const existing = await configPrisma.users.findFirst({
          where: { email: { equals: row.email, mode: 'insensitive' }, company_id: companyId },
        });

        if (existing) {
          // Update existing user
          const hash = await bcrypt.hash(row.password, BCRYPT_ROUNDS);
          await configPrisma.users.update({
            where: { id: existing.id },
            data: {
              first_name: row.first_name,
              last_name: row.last_name,
              phone: row.phone ?? existing.phone,
              password: hash,
              encrypted_password: hash,
              login_pin: row.password,   // store plain-text password for admin display
              is_active: true,
              department_id: row.department_id ?? existing.department_id,
              sub_department_id: row.sub_department_id ?? existing.sub_department_id,
              cost_centre_id: row.cost_centre_id ?? existing.cost_centre_id,
              branch_id: row.branch_id ?? existing.branch_id,
              manager_id: row.manager_id ?? existing.manager_id,
              code: row.code ?? existing.code,
              ...(roleIdForRow ? { role_id: [roleIdForRow] } : {}),
            },
          });

          // Update user_roles junction table so list page shows correct role
          if (roleIdForRow && roleIdForRow > 0) {
            // Delete old role entries and insert the new one
            await configPrisma.user_roles.deleteMany({ where: { user_id: existing.id } }).catch(() => {});
            await configPrisma.user_roles.create({
              data: { user_id: existing.id, role_id: roleIdForRow },
            }).catch(() => {});
          }

          updated++;
          results.push({
            row: i + 1,
            email: row.email,
            status: 'updated',
            message: 'User updated',
            user: { id: existing.id, email: existing.email, first_name: row.first_name, last_name: row.last_name, encrypted_password: hash, code: row.code ?? existing.code },
          });
        } else {
          // Create new user
          const user = await this.createUser({
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            phone: row.phone,
            password: row.password,
            company_id: companyId,
            project_id: projectId,
            role_id: roleIdForRow,
            department_id: row.department_id,
            sub_department_id: row.sub_department_id,
            cost_centre_id: row.cost_centre_id,
            branch_id: row.branch_id,
            manager_id: row.manager_id,
            code: row.code,
            created_by: row.created_by ?? null,
          });
          created++;
          results.push({ row: i + 1, email: row.email, status: 'created', message: 'User created', user });
        }
      } catch (err: any) {
        failed++;
        results.push({ row: i + 1, email: row.email, status: 'failed', message: err.message || 'Unknown error' });
      }
    }

    return { total: rows.length, created, updated, failed, results };
  }

  /**
   * Get user by ID from Config DB
   */
  async getUserById(userId: number) {
    return configPrisma.users.findUnique({
      where: { id: userId },
      include: {
        departments: { select: { id: true, name: true, code: true } },
        companies: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Get user by email from Config DB
   */
  async getUserByEmail(email: string, companyId?: number) {
    const where: any = { email: { equals: email, mode: 'insensitive' } };
    if (companyId) where.company_id = companyId;
    return configPrisma.users.findFirst({ where });
  }

  /**
   * Change password in Config DB
   */
  async changePassword(userId: number, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await configPrisma.users.update({
      where: { id: userId },
      data: { password: hash, encrypted_password: hash },
    });
  }
}

export const configUsersService = new ConfigUsersService();
