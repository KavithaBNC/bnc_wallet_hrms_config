import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import type { CreateEmployeeSeparationInput, UpdateEmployeeSeparationInput, QueryEmployeeSeparationsInput } from '../utils/employee-separation.validation';
import { EmployeeStatus } from '@prisma/client';
import { configuratorService } from './configurator.service';

/** Map DB row (snake_case) to API shape (camelCase) */
type DbRow = {
  id: string;
  employee_id: string;
  organization_id: string;
  resignation_apply_date: Date;
  notice_period: number;
  notice_period_reason: string | null;
  relieving_date: Date;
  reason_of_leaving: string | null;
  separation_type: string;
  remarks: string | null;
  created_at: Date;
  updated_at: Date;
};

function toSeparation(row: DbRow) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    organizationId: row.organization_id,
    resignationApplyDate: row.resignation_apply_date,
    noticePeriod: row.notice_period,
    noticePeriodReason: row.notice_period_reason,
    relievingDate: row.relieving_date,
    reasonOfLeaving: row.reason_of_leaving,
    separationType: row.separation_type,
    remarks: row.remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class EmployeeSeparationService {
  async create(data: CreateEmployeeSeparationInput, loggedInUserId?: string) {
    // Resolve employeeId from configuratorUserId if not provided directly
    let isConfiguratorOnly = false;
    if (!data.employeeId && data.configuratorUserId) {
      const emp = await prisma.employee.findFirst({
        where: { configuratorUserId: data.configuratorUserId, organizationId: data.organizationId },
        select: { id: true },
      });
      if (emp) {
        data.employeeId = emp.id;
      } else {
        // Configurator-only user (no local HRMS employee record)
        isConfiguratorOnly = true;
      }
    }

    // If Configurator-only user, call Configurator API directly and return
    if (isConfiguratorOnly && data.configuratorUserId) {
      console.log(`[EmployeeSeparation] Configurator-only user separation for configuratorUserId=${data.configuratorUserId}`);

      // Get admin's access token
      let accessToken: string | null = null;
      let companyId: number | null = null;

      if (loggedInUserId) {
        const adminUser = await prisma.user.findUnique({
          where: { id: loggedInUserId },
          select: { configuratorAccessToken: true, configuratorCompanyId: true },
        });
        accessToken = adminUser?.configuratorAccessToken ?? null;
        companyId = adminUser?.configuratorCompanyId ?? null;
      }

      // Get companyId from organization if not from admin user
      if (!companyId) {
        const org = await prisma.organization.findUnique({
          where: { id: data.organizationId },
          select: { configuratorCompanyId: true },
        });
        companyId = org?.configuratorCompanyId ?? null;
      }

      if (!accessToken) {
        throw new AppError('Admin user does not have a Configurator access token. Please re-login.', 401);
      }
      if (!companyId) {
        throw new AppError('Organization does not have a Configurator company ID configured.', 400);
      }

      // Map HRMS separation type to Configurator API values
      const separationTypeMap: Record<string, string> = {
        RESIGNATION: 'resignation',
        TERMINATION: 'termination',
        RETIREMENT: 'retirement',
        ABSONDING: 'absconding',
        CONTRACT_END: 'resignation',
        OTHER: 'resignation',
      };
      const configSeparationType = separationTypeMap[data.separationType] ?? 'resignation';

      // Try with current token; if 401, refresh token and retry once
      let currentToken = accessToken;
      let lastError: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const apiResponse = await configuratorService.separateUser(currentToken, {
            company_id: companyId,
            user_id: data.configuratorUserId,
            remarks: data.remarks ?? '',
            separation_type: configSeparationType,
          });
          console.log(`[EmployeeSeparation] Configurator separate API SUCCESS for user_id=${data.configuratorUserId}, company_id=${companyId}`, apiResponse);
          return {
            id: '',
            employeeId: '',
            organizationId: data.organizationId,
            resignationApplyDate: data.resignationApplyDate,
            noticePeriod: data.noticePeriod,
            noticePeriodReason: data.noticePeriodReason ?? null,
            relievingDate: data.relievingDate,
            reasonOfLeaving: data.reasonOfLeaving ?? null,
            separationType: data.separationType,
            remarks: data.remarks ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            employee: null,
            configuratorResult: { called: true, success: true },
          };
        } catch (err: any) {
          lastError = err;
          const status = err?.statusCode ?? err?.response?.status;
          // On 401, try to refresh the Configurator token
          if (attempt === 0 && status === 401 && loggedInUserId) {
            console.log('[EmployeeSeparation] Configurator token expired, attempting refresh...');
            try {
              const adminUserFull = await prisma.user.findUnique({
                where: { id: loggedInUserId },
                select: { configuratorRefreshToken: true },
              });
              if (adminUserFull?.configuratorRefreshToken) {
                const refreshed = await configuratorService.refreshToken(adminUserFull.configuratorRefreshToken);
                if (refreshed?.access_token) {
                  currentToken = refreshed.access_token;
                  await prisma.user.update({
                    where: { id: loggedInUserId },
                    data: {
                      configuratorAccessToken: refreshed.access_token,
                      ...(refreshed.refresh_token ? { configuratorRefreshToken: refreshed.refresh_token } : {}),
                    },
                  });
                  console.log('[EmployeeSeparation] Configurator token refreshed, retrying...');
                  continue;
                }
              }
            } catch (refreshErr) {
              console.error('[EmployeeSeparation] Token refresh failed:', refreshErr instanceof Error ? refreshErr.message : refreshErr);
            }
          }
          break;
        }
      }
      // Extract error message properly
      console.error('[EmployeeSeparation] Configurator separate API raw error:', JSON.stringify(lastError, Object.getOwnPropertyNames(lastError ?? {})));
      let errMsg = 'Unknown error';
      if (lastError instanceof Error) {
        errMsg = lastError.message;
      } else if (typeof lastError === 'string') {
        errMsg = lastError;
      } else if (lastError?.response?.data) {
        errMsg = lastError.response.data.detail ?? lastError.response.data.message ?? JSON.stringify(lastError.response.data);
      } else {
        errMsg = JSON.stringify(lastError);
      }
      console.error('[EmployeeSeparation] Configurator separate API FAILED:', errMsg);
      throw new AppError(`Configurator separation failed: ${errMsg}`, lastError?.statusCode ?? 500);
    }

    if (!data.employeeId) throw new AppError('Employee ID or Configurator User ID is required', 400);

    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { organizationId: true },
    });
    if (!employee) throw new AppError('Employee not found', 404);
    if (employee.organizationId !== data.organizationId) {
      throw new AppError('Employee does not belong to this organization', 400);
    }

    const resignationApplyDate = new Date(data.resignationApplyDate);
    const relievingDate = new Date(data.relievingDate);

    const insertSql = `
      INSERT INTO employee_separations (
        employee_id, organization_id, resignation_apply_date, notice_period,
        notice_period_reason, relieving_date, reason_of_leaving, separation_type, remarks,
        updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::"separation_type", $9, NOW())
      RETURNING id, employee_id, organization_id, resignation_apply_date, notice_period,
        notice_period_reason, relieving_date, reason_of_leaving, separation_type, remarks,
        created_at, updated_at
    `;
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(
      insertSql,
      data.employeeId,
      data.organizationId,
      resignationApplyDate,
      data.noticePeriod,
      data.noticePeriodReason ?? null,
      relievingDate,
      data.reasonOfLeaving ?? null,
      data.separationType,
      data.remarks ?? null
    );
    const row = rows[0];
    if (!row) throw new AppError('Failed to create separation', 500);

    const emp = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
    });

    // Update employee: dateOfLeaving, status; disable login (user.isActive = false)
    const newStatus: EmployeeStatus = data.separationType === 'RESIGNATION' ? EmployeeStatus.RESIGNED : EmployeeStatus.TERMINATED;
    const updatedEmp = await prisma.employee.update({
      where: { id: data.employeeId },
      data: {
        dateOfLeaving: relievingDate,
        terminationReason: data.reasonOfLeaving ?? data.separationType,
        employeeStatus: newStatus,
      },
      select: { userId: true },
    });
    await prisma.user.update({
      where: { id: updatedEmp.userId },
      data: { isActive: false },
    });

    // Notify Configurator API about the separation
    let configuratorResult: { called: boolean; success?: boolean; error?: string } = { called: false };
    try {
      const adminUserId = loggedInUserId ?? updatedEmp.userId;
      const adminUser = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { configuratorAccessToken: true, configuratorCompanyId: true },
      });

      const separatedEmployee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: { configuratorUserId: true },
      });
      const separatedUser = await prisma.user.findUnique({
        where: { id: updatedEmp.userId },
        select: { configuratorUserId: true, configuratorCompanyId: true },
      });

      const org = await prisma.organization.findUnique({
        where: { id: data.organizationId },
        select: { configuratorCompanyId: true },
      });

      const accessToken = adminUser?.configuratorAccessToken;
      const userId = data.configuratorUserId ?? separatedEmployee?.configuratorUserId ?? separatedUser?.configuratorUserId;
      const companyId = org?.configuratorCompanyId ?? adminUser?.configuratorCompanyId ?? separatedUser?.configuratorCompanyId;

      const separationTypeMap2: Record<string, string> = {
        RESIGNATION: 'resignation', TERMINATION: 'termination', RETIREMENT: 'retirement',
        ABSONDING: 'absconding', CONTRACT_END: 'resignation', OTHER: 'resignation',
      };
      const configSepType = separationTypeMap2[data.separationType] ?? 'resignation';

      console.log(`[EmployeeSeparation] Configurator API — token=${!!accessToken}, companyId=${companyId}, userId=${userId}, separationType=${configSepType}`);

      if (accessToken && companyId && userId) {
        configuratorResult.called = true;
        await configuratorService.separateUser(accessToken, {
          company_id: companyId,
          user_id: userId,
          remarks: data.remarks ?? '',
          separation_type: configSepType,
        });
        configuratorResult.success = true;
        console.log(`[EmployeeSeparation] Configurator separate API SUCCESS for user_id=${userId}, company_id=${companyId}`);
      } else {
        console.warn(`[EmployeeSeparation] Skipped Configurator API – token=${!!accessToken}, companyId=${companyId}, userId=${userId}`);
      }
    } catch (err) {
      configuratorResult.success = false;
      configuratorResult.error = err instanceof Error ? err.message : String(err);
      console.error('[EmployeeSeparation] Configurator separate API FAILED:', configuratorResult.error);
    }

    return { ...toSeparation(row), employee: emp, configuratorResult };
  }

  async getAll(query: QueryEmployeeSeparationsInput) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || 'resignation_apply_date';
    const sortOrder = (query.sortOrder || 'desc').toUpperCase();
    const validSort = ['resignation_apply_date', 'relieving_date', 'created_at'].includes(sortBy) ? sortBy : 'resignation_apply_date';

    let whereClause = '1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (query.organizationId) {
      whereClause += ` AND s.organization_id = $${paramIndex}::uuid`;
      params.push(query.organizationId);
      paramIndex++;
    }

    if (query.search && query.search.trim()) {
      whereClause += ` AND (e.employee_code ILIKE $${paramIndex} OR e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex})`;
      params.push(`%${query.search.trim()}%`);
      paramIndex++;
    }

    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*)::int AS count FROM employee_separations s
       INNER JOIN employees e ON e.id = s.employee_id
       WHERE ${whereClause}`,
      ...params
    );
    const total = Number(countResult[0]?.count ?? 0);

    const listParams = [...params, limit, skip];
    const listPlaceholderLimit = `$${paramIndex}`;
    const listPlaceholderOffset = `$${paramIndex + 1}`;
    const listQuery = `
      SELECT s.id, s.employee_id, s.organization_id, s.resignation_apply_date, s.notice_period,
             s.notice_period_reason, s.relieving_date, s.reason_of_leaving, s.separation_type, s.remarks,
             s.created_at, s.updated_at
      FROM employee_separations s
      INNER JOIN employees e ON e.id = s.employee_id
      WHERE ${whereClause}
      ORDER BY s.${validSort} ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}
      LIMIT ${listPlaceholderLimit} OFFSET ${listPlaceholderOffset}
    `;
    const rows = await prisma.$queryRawUnsafe<DbRow[]>(listQuery, ...listParams);

    const employeeIds = [...new Set(rows.map((r) => r.employee_id))];
    const employees = employeeIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const separations = rows.map((r) => ({
      ...toSeparation(r),
      employee: empMap.get(r.employee_id) ?? null,
    }));

    return {
      separations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const rows = await prisma.$queryRaw<
      (DbRow & {
        e_id: string;
        employee_code: string;
        first_name: string;
        last_name: string;
        email: string;
        e_organization_id: string;
        o_id: string;
        o_name: string;
      })[]
    >`
      SELECT s.id, s.employee_id, s.organization_id, s.resignation_apply_date, s.notice_period,
             s.notice_period_reason, s.relieving_date, s.reason_of_leaving, s.separation_type, s.remarks,
             s.created_at, s.updated_at,
             e.id AS e_id, e.employee_code, e.first_name, e.last_name, e.email, e.organization_id AS e_organization_id,
             o.id AS o_id, o.name AS o_name
      FROM employee_separations s
      INNER JOIN employees e ON e.id = s.employee_id
      INNER JOIN organizations o ON o.id = s.organization_id
      WHERE s.id = ${id}::uuid
    `;
    const row = rows[0];
    if (!row) throw new AppError('Separation record not found', 404);

    return {
      ...toSeparation(row),
      employee: {
        id: row.e_id,
        employeeCode: row.employee_code,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        organizationId: row.e_organization_id,
      },
      organization: { id: row.o_id, name: row.o_name },
    };
  }

  async update(id: string, data: UpdateEmployeeSeparationInput) {
    const existingRows = await prisma.$queryRaw<DbRow[]>`
      SELECT id, employee_id, organization_id, resignation_apply_date, notice_period,
             notice_period_reason, relieving_date, reason_of_leaving, separation_type, remarks,
             created_at, updated_at
      FROM employee_separations WHERE id = ${id}::uuid
    `;
    const existing = existingRows[0];
    if (!existing) throw new AppError('Separation record not found', 404);

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.resignationApplyDate != null) {
      updates.push(`resignation_apply_date = $${idx}::date`);
      values.push(new Date(data.resignationApplyDate));
      idx++;
    }
    if (data.noticePeriod != null) {
      updates.push(`notice_period = $${idx}`);
      values.push(data.noticePeriod);
      idx++;
    }
    if (data.noticePeriodReason !== undefined) {
      updates.push(`notice_period_reason = $${idx}`);
      values.push(data.noticePeriodReason);
      idx++;
    }
    if (data.relievingDate != null) {
      updates.push(`relieving_date = $${idx}::date`);
      values.push(new Date(data.relievingDate));
      idx++;
    }
    if (data.reasonOfLeaving !== undefined) {
      updates.push(`reason_of_leaving = $${idx}`);
      values.push(data.reasonOfLeaving);
      idx++;
    }
    if (data.separationType != null) {
      updates.push(`separation_type = $${idx}::"separation_type"`);
      values.push(data.separationType);
      idx++;
    }
    if (data.remarks !== undefined) {
      updates.push(`remarks = $${idx}`);
      values.push(data.remarks);
      idx++;
    }
    if (updates.length === 0) {
      const emp = await prisma.employee.findUnique({
        where: { id: existing.employee_id },
        select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
      });
      return { ...toSeparation(existing), employee: emp };
    }
    updates.push(`updated_at = NOW()`);
    values.push(id);
    const wherePlaceholder = values.length;

    const sql = `UPDATE employee_separations SET ${updates.join(', ')} WHERE id = $${wherePlaceholder}::uuid RETURNING id, employee_id, organization_id, resignation_apply_date, notice_period, notice_period_reason, relieving_date, reason_of_leaving, separation_type, remarks, created_at, updated_at`;
    const updatedRows = await prisma.$queryRawUnsafe<DbRow[]>(sql, ...values);
    const updated = updatedRows[0];
    if (!updated) throw new AppError('Failed to update separation', 500);

    const effectiveRelieving = data.relievingDate != null ? new Date(data.relievingDate) : existing.relieving_date;
    const effectiveType = (data.separationType ?? existing.separation_type) as string;
    const effectiveReason = data.reasonOfLeaving ?? existing.reason_of_leaving ?? effectiveType;
    const newStatus: EmployeeStatus = effectiveType === 'RESIGNATION' ? EmployeeStatus.RESIGNED : EmployeeStatus.TERMINATED;
    const emp = await prisma.employee.update({
      where: { id: existing.employee_id },
      data: {
        dateOfLeaving: effectiveRelieving,
        terminationReason: effectiveReason,
        employeeStatus: newStatus,
      },
      select: { userId: true },
    });
    await prisma.user.update({
      where: { id: emp.userId },
      data: { isActive: false },
    });

    const employee = await prisma.employee.findUnique({
      where: { id: existing.employee_id },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
    });
    return { ...toSeparation(updated), employee };
  }

  async delete(id: string) {
    const rows = await prisma.$queryRaw<DbRow[]>`
      SELECT id, employee_id FROM employee_separations WHERE id = ${id}::uuid
    `;
    if (rows.length === 0) throw new AppError('Separation record not found', 404);
    const employeeId = rows[0].employee_id;

    await prisma.$executeRaw`DELETE FROM employee_separations WHERE id = ${id}::uuid`;

    // Restore employee to ACTIVE and reactivate their login
    const emp = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        employeeStatus: EmployeeStatus.ACTIVE,
        dateOfLeaving: null,
        terminationReason: null,
      },
      select: { userId: true },
    });
    await prisma.user.update({
      where: { id: emp.userId },
      data: { isActive: true },
    });

    return { deleted: true };
  }
}

export const employeeSeparationService = new EmployeeSeparationService();
