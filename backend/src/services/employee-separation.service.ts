import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import type { CreateEmployeeSeparationInput, UpdateEmployeeSeparationInput, QueryEmployeeSeparationsInput } from '../utils/employee-separation.validation';
import { EmployeeStatus } from '@prisma/client';

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
  async create(data: CreateEmployeeSeparationInput) {
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
        notice_period_reason, relieving_date, reason_of_leaving, separation_type, remarks
      )
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::"SeparationType", $9)
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

    return { ...toSeparation(row), employee: emp };
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
      updates.push(`separation_type = $${idx}::"SeparationType"`);
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
      SELECT id FROM employee_separations WHERE id = ${id}::uuid
    `;
    if (rows.length === 0) throw new AppError('Separation record not found', 404);
    await prisma.$executeRaw`DELETE FROM employee_separations WHERE id = ${id}::uuid`;
    return { deleted: true };
  }
}

export const employeeSeparationService = new EmployeeSeparationService();
