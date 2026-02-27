import { prisma } from '../utils/prisma';

export interface ApprovalLevelConfig {
  id: string;
  level: number;
  levelName: string;
  associate: string;
  hierarchy: string;
  paygroup: string;
  department: string;
  approvalLevel: string;
}

/** Parse approvalLevels from Prisma JSON - use this to avoid JsonValue cast errors. */
export function parseApprovalLevels(value: unknown): ApprovalLevelConfig[] | null {
  if (!Array.isArray(value)) return null;
  return value as unknown as ApprovalLevelConfig[];
}

/**
 * Resolves the approver employee for a given approval level based on hierarchy rules.
 * Rule-based, no hardcoded employee IDs.
 */
export async function resolveApproverForLevel(
  employeeId: string,
  organizationId: string,
  levelConfig: ApprovalLevelConfig,
  _levelIndex: number
): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: {
        include: { manager: true },
      },
      reportingManager: true,
    },
  });

  if (!employee) return null;

  // If level has specific associate (employee id), use that
  if (levelConfig.associate && /^[0-9a-f-]{36}$/i.test(levelConfig.associate)) {
    const specified = await prisma.employee.findFirst({
      where: {
        id: levelConfig.associate,
        organizationId,
      },
    });
    return specified?.id ?? null;
  }

  const hierarchy = (levelConfig.hierarchy || '').toLowerCase();

  // Level 1: Reporting Manager / HR
  if (hierarchy.includes('reporting_manager') || hierarchy.includes('reporting manager')) {
    return employee.reportingManagerId;
  }

  if (hierarchy.includes('department_head') || hierarchy.includes('department head')) {
    return employee.department?.managerId ?? null;
  }

  if (hierarchy.includes('hr_manager') || hierarchy.includes('hr manager')) {
    return resolveHrManager(organizationId);
  }

  // Level 2: HR Head
  if (hierarchy.includes('hr_head') || hierarchy.includes('hr head')) {
    return resolveHrHead(organizationId);
  }

  // Level 3: Admin
  if (hierarchy.includes('admin')) {
    return resolveAdmin(organizationId);
  }

  // Fallback: Reporting Manager
  return employee.reportingManagerId;
}

async function resolveHrManager(organizationId: string): Promise<string | null> {
  const hrDept = await prisma.department.findFirst({
    where: {
      organizationId,
      OR: [
        { name: { contains: 'HR', mode: 'insensitive' } },
        { code: { contains: 'HR', mode: 'insensitive' } },
      ],
    },
    include: { manager: true },
  });
  return hrDept?.managerId ?? null;
}

async function resolveHrHead(organizationId: string): Promise<string | null> {
  return resolveHrManager(organizationId);
}

async function resolveAdmin(organizationId: string): Promise<string | null> {
  const adminUser = await prisma.user.findFirst({
    where: {
      role: 'ORG_ADMIN',
      employee: {
        organizationId,
        employeeStatus: 'ACTIVE',
      },
    },
    include: { employee: true },
  });
  return adminUser?.employee?.id ?? null;
}

/**
 * Get the first approver (Level 1) for a leave/request.
 */
export async function getFirstApprover(
  employeeId: string,
  organizationId: string,
  approvalLevels: ApprovalLevelConfig[] | null
): Promise<string | null> {
  if (!approvalLevels || approvalLevels.length === 0) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { reportingManagerId: true },
    });
    return emp?.reportingManagerId ?? null;
  }

  const level1 = approvalLevels.find((l) => l.level === 1) ?? approvalLevels[0];
  return resolveApproverForLevel(employeeId, organizationId, level1, 0);
}

/**
 * Get the next approver after current level, or null if no more levels.
 */
export async function getNextApprover(
  employeeId: string,
  organizationId: string,
  approvalLevels: ApprovalLevelConfig[],
  currentLevel: number
): Promise<string | null> {
  const nextLevel = approvalLevels.find((l) => l.level === currentLevel + 1);
  if (!nextLevel) return null;

  return resolveApproverForLevel(
    employeeId,
    organizationId,
    nextLevel,
    currentLevel
  );
}
