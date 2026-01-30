import { AppError } from '../middlewares/errorHandler';
import { prisma } from '../utils/prisma';
import { employeeService } from './employee.service';

export interface SubmitChangeRequestInput {
  employeeId: string;
  submittedById: string;
  organizationId: string;
  existingData: Record<string, unknown>;
  requestedData: Record<string, unknown>;
}

export class EmployeeChangeRequestService {
  async submit(data: SubmitChangeRequestInput) {
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, deletedAt: null },
    });
    if (!employee) throw new AppError('Employee not found', 404);
    if (employee.organizationId !== data.organizationId) {
      throw new AppError('Employee does not belong to this organization', 403);
    }

    const request = await prisma.employeeChangeRequest.create({
      data: {
        employeeId: data.employeeId,
        submittedById: data.submittedById,
        organizationId: data.organizationId,
        existingData: data.existingData as object,
        requestedData: data.requestedData as object,
      },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      },
    });
    return request;
  }

  async listPending(organizationId: string | null) {
    const list = await prisma.employeeChangeRequest.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        status: 'PENDING',
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        submittedBy: { select: { id: true, email: true } },
      },
    });
    return list;
  }

  async getById(id: string, organizationId?: string) {
    const request = await prisma.employeeChangeRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        submittedBy: { select: { id: true, email: true } },
      },
    });
    if (!request) throw new AppError('Change request not found', 404);
    if (organizationId && request.organizationId !== organizationId) {
      throw new AppError('Access denied', 403);
    }
    return request;
  }

  /**
   * Keys allowed on Employee model for update (Prisma). Excludes relations and
   * frontend-only keys (academicQualifications, previousEmployments, familyMembers).
   */
  private static readonly EMPLOYEE_UPDATE_KEYS = new Set([
    'employeeCode', 'paygroupId', 'firstName', 'middleName', 'lastName', 'email',
    'personalEmail', 'phone', 'officialEmail', 'officialMobile', 'dateOfBirth',
    'gender', 'maritalStatus', 'nationality', 'profilePictureUrl',
    'departmentId', 'positionId', 'reportingManagerId', 'shiftId', 'workLocation',
    'entityId', 'locationId', 'costCentreId', 'grade', 'placeOfTaxDeduction', 'jobResponsibility',
    'employmentType', 'employeeStatus', 'dateOfJoining', 'probationEndDate',
    'confirmationDate', 'dateOfLeaving', 'terminationReason',
    'address', 'emergencyContacts', 'bankDetails', 'taxInformation', 'documents',
    'role',
  ]);

  async approve(id: string, approvedById: string, organizationId?: string) {
    const request = await this.getById(id, organizationId);
    if (request.status !== 'PENDING') {
      throw new AppError('This request has already been processed', 400);
    }

    const requestedData = request.requestedData as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const key of Object.keys(requestedData)) {
      if (EmployeeChangeRequestService.EMPLOYEE_UPDATE_KEYS.has(key)) {
        sanitized[key] = requestedData[key];
      }
    }
    await employeeService.update(request.employeeId, sanitized as any);

    // Persist academic qualifications, previous employments, family members (stored in profileExtensions)
    const academicQualifications = requestedData.academicQualifications;
    const previousEmployments = requestedData.previousEmployments;
    const familyMembers = requestedData.familyMembers;
    if (
      Array.isArray(academicQualifications) ||
      Array.isArray(previousEmployments) ||
      Array.isArray(familyMembers)
    ) {
      await employeeService.updateProfileExtensions(request.employeeId, {
        academicQualifications: Array.isArray(academicQualifications) ? academicQualifications : undefined,
        previousEmployments: Array.isArray(previousEmployments) ? previousEmployments : undefined,
        familyMembers: Array.isArray(familyMembers) ? familyMembers : undefined,
      });
    }

    await prisma.employeeChangeRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date() },
    });

    return prisma.employeeChangeRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      },
    });
  }

  async reject(id: string, rejectionReason: string | undefined, organizationId?: string) {
    const request = await this.getById(id, organizationId);
    if (request.status !== 'PENDING') {
      throw new AppError('This request has already been processed', 400);
    }

    await prisma.employeeChangeRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: rejectionReason || null },
    });

    return prisma.employeeChangeRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      },
    });
  }
}

export const employeeChangeRequestService = new EmployeeChangeRequestService();
