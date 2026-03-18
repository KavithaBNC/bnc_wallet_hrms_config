import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';

/**
 * Resolves the applicable WorkflowMapping for an employee based on:
 * - Paygroup
 * - Department
 * - Associate scope (employee id in associateIds or "all")
 * When multiple match, returns the one with highest priority (lowest priority number).
 */
export async function resolveWorkflowForEmployee(employeeId: string, organizationId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      paygroup: true,
      department: true,
    },
  });

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  if (employee.organizationId !== organizationId) {
    throw new AppError('Employee does not belong to this organization', 403);
  }

  const workflows = await prisma.workflowMapping.findMany({
    where: { organizationId },
    orderBy: { priority: 'asc' },
    include: {
      paygroup: true,
      department: true,
    },
  });

  const matching: typeof workflows = [];

  for (const w of workflows) {
    // Paygroup match: null/empty = all; else employee's paygroupId must be in paygroupIds
    const paygroupIds = Array.isArray(w.paygroupIds) ? (w.paygroupIds as string[]) : [];
    const paygroupMatch =
      !paygroupIds.length ||
      (employee.paygroupId && paygroupIds.includes(employee.paygroupId));

    // Department match: null/empty = all; else employee's departmentId must be in departmentIds
    const departmentIds = Array.isArray(w.departmentIds) ? (w.departmentIds as string[]) : [];
    const departmentMatch =
      !departmentIds.length ||
      (employee.departmentId && departmentIds.includes(employee.departmentId));

    // Associate match: null/empty = all; else employee id must be in associateIds
    const associateIds = Array.isArray(w.associateIds) ? (w.associateIds as string[]) : [];
    const associateMatch = !associateIds.length || associateIds.includes(employee.id);

    if (paygroupMatch && departmentMatch && associateMatch) {
      matching.push(w);
    }
  }

  if (matching.length === 0) {
    throw new AppError(
      'No workflow configured for your paygroup/department. Please contact HR.',
      400
    );
  }

  // Highest priority = lowest priority number; already ordered asc
  return matching[0];
}

/**
 * Resolves workflow if any exist; returns null when no workflows configured (fallback to reporting manager).
 * When workflows exist but none match, throws AppError.
 */
export async function resolveWorkflowForEmployeeOrNull(
  employeeId: string,
  organizationId: string
) {
  const count = await prisma.workflowMapping.count({ where: { organizationId } });
  if (count === 0) return null;
  return resolveWorkflowForEmployee(employeeId, organizationId);
}
