/**
 * Config Auth Service — Direct Config DB access (replaces RAG API auth calls)
 * Replaces: POST /api/v1/auth/login, POST /api/v1/auth/token/refresh,
 *           GET /api/v1/user-roles/{role_id}, GET /api/v1/user-roles/
 */

import bcrypt from 'bcryptjs';
import { configPrisma } from '../utils/config-prisma';
import { AppError } from '../middlewares/errorHandler';

export interface ConfigAuthLoginResult {
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    company_id: number | null;
    role_id: number[];
    department_id: number | null;
    sub_department_id: number | null;
    cost_centre_id: number | null;
    manager_id: number | null;
    is_active: boolean;
    code: string | null;
    encrypted_password: string | null;
  };
  company: {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
  } | null;
  roles: Array<{ id: number; name: string; code: string }>;
}

export interface ConfigRole {
  id: number;
  name: string;
  code: string;
  role_type: string | null;
  description: string | null;
  company_id: number | null;
  is_active: boolean;
}

class ConfigAuthService {
  /**
   * Step 1: Verify company exists in Config DB
   */
  async verifyCompany(companyNameOrCode: string): Promise<{
    success: boolean;
    step: number;
    message: string;
    company?: { id: number; name: string; code: string; is_active: boolean };
  }> {
    try {
      const company = await configPrisma.companies.findFirst({
        where: {
          OR: [
            { name: { equals: companyNameOrCode, mode: 'insensitive' } },
            { code: { equals: companyNameOrCode, mode: 'insensitive' } },
          ],
          is_active: true,
        },
        select: { id: true, name: true, code: true, is_active: true },
      });

      if (!company) {
        return { success: false, step: 1, message: 'Company not found' };
      }

      return {
        success: true,
        step: 1,
        message: 'Company verified',
        company: { id: company.id, name: company.name, code: company.code, is_active: company.is_active },
      };
    } catch (err) {
      console.error('[configAuthService.verifyCompany] Error:', err);
      throw new AppError('Failed to verify company', 500);
    }
  }

  /**
   * Login: Verify credentials against Config DB
   */
  async login(username: string, password: string, companyId?: number, companyNameOrCode?: string): Promise<ConfigAuthLoginResult> {
    try {
      // Resolve company if needed
      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId && companyNameOrCode) {
        const company = await configPrisma.companies.findFirst({
          where: {
            OR: [
              { name: { equals: companyNameOrCode, mode: 'insensitive' } },
              { code: { equals: companyNameOrCode, mode: 'insensitive' } },
            ],
            is_active: true,
          },
        });
        if (!company) throw new AppError('Company not found. Please check the name or code.', 401);
        resolvedCompanyId = company.id;
      }

      // Find user by email
      const whereClause: any = { email: { equals: username, mode: 'insensitive' } };
      if (resolvedCompanyId) whereClause.company_id = resolvedCompanyId;

      const user = await configPrisma.users.findFirst({
        where: whereClause,
        include: {
          companies: { select: { id: true, name: true, code: true, is_active: true } },
          departments: { select: { id: true, name: true, code: true } },
        },
      });

      if (!user) throw new AppError('Invalid username or password', 401);
      if (!user.is_active) throw new AppError('Account is deactivated. Please contact your administrator.', 401);

      // Verify password — prefer the bcrypt hash in `password` field;
      // `encrypted_password` may contain a Fernet/Django-encrypted value (not bcrypt)
      const bcryptHash = [user.password, user.encrypted_password].find(
        (h) => h && h.startsWith('$2'),
      );
      if (!bcryptHash) throw new AppError('Invalid username or password', 401);

      const isValid = await bcrypt.compare(password, bcryptHash);
      if (!isValid) throw new AppError('Invalid username or password', 401);

      // Fetch roles via user_roles junction table
      const userRoleRecords = await configPrisma.user_roles.findMany({
        where: { user_id: user.id },
        include: { roles: { select: { id: true, name: true, code: true } } },
      });
      const roles = userRoleRecords.map((ur) => ur.roles);

      // Fetch company
      const company = user.companies
        ? { id: user.companies.id, name: user.companies.name, code: user.companies.code, is_active: user.companies.is_active }
        : null;

      return {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          company_id: user.company_id,
          role_id: user.role_id,
          department_id: user.department_id,
          sub_department_id: user.sub_department_id,
          cost_centre_id: user.cost_centre_id,
          manager_id: user.manager_id,
          is_active: user.is_active,
          code: user.code,
          encrypted_password: user.encrypted_password,
        },
        company,
        roles,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error('[configAuthService.login] Error:', err);
      throw new AppError('Login failed', 500);
    }
  }

  /**
   * Get role by ID from Config DB
   * Replaces: GET /api/v1/user-roles/{role_id}
   */
  async getUserRole(roleId: number): Promise<ConfigRole | null> {
    try {
      const role = await configPrisma.roles.findUnique({
        where: { id: roleId },
        select: { id: true, name: true, code: true, role_type: true, description: true, company_id: true, is_active: true },
      });
      return role;
    } catch {
      return null;
    }
  }

  /**
   * Get all roles for a company from Config DB (from roles table directly)
   * Replaces: GET /api/v1/user-roles/?company_id=X
   */
  async getUserRoles(companyId: number): Promise<ConfigRole[]> {
    try {
      const roles = await configPrisma.roles.findMany({
        where: { company_id: companyId, is_active: true },
        select: { id: true, name: true, code: true, role_type: true, description: true, company_id: true, is_active: true },
        orderBy: { name: 'asc' },
      });
      return roles;
    } catch {
      return [];
    }
  }

  /**
   * Get user's project-specific roles
   */
  async getUserProjectRoles(userId: number, projectId: number, companyId: number): Promise<Array<{ role_id: number; is_active: boolean | null }>> {
    try {
      const records = await configPrisma.user_project_roles.findMany({
        where: { user_id: userId, project_id: projectId, company_id: companyId },
      });
      return records.map((r) => ({ role_id: r.role_id, is_active: r.is_active }));
    } catch {
      return [];
    }
  }

  /**
   * Get company by ID
   */
  async getCompanyById(companyId: number) {
    return configPrisma.companies.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, code: true, is_active: true, employee_id_prefix: true, employee_id_starting_number: true },
    });
  }
}

export const configAuthService = new ConfigAuthService();
