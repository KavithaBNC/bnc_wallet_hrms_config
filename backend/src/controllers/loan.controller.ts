import { Request, Response, NextFunction } from 'express';
import { loanService } from '../services/loan.service';
import { AppError } from '../middlewares/errorHandler';
import {
  createLoanSchema,
  queryLoanSchema,
  recordRepaymentSchema,
} from '../utils/loan.validation';

export class LoanController {
  async createLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createLoanSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new AppError(parsed.error.errors[0]?.message || 'Validation error', 400));
      }
      const loan = await loanService.create(parsed.data);
      return res.status(201).json({ success: true, data: loan });
    } catch (error) {
      return next(error);
    }
  }

  async getAllLoans(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = queryLoanSchema.safeParse({
        ...req.query,
        organizationId: (req as any).rbac?.organizationId ?? req.query.organizationId,
      });
      if (!parsed.success) {
        return next(new AppError(parsed.error.errors[0]?.message || 'Validation error', 400));
      }
      const result = await loanService.getAll(parsed.data);
      return res.json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  }

  async getLoanById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId ?? req.query.organizationId as string;
      if (!organizationId) return next(new AppError('Organization ID is required', 400));
      const loan = await loanService.getById(req.params.id, organizationId);
      return res.json({ success: true, data: loan });
    } catch (error) {
      return next(error);
    }
  }

  async approveLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId;
      const approvedBy = (req as any).user?.id;
      if (!organizationId) return next(new AppError('Organization context required', 400));
      const loan = await loanService.approve(req.params.id, organizationId, approvedBy);
      return res.json({ success: true, data: loan, message: 'Loan approved successfully' });
    } catch (error) {
      return next(error);
    }
  }

  async disburseLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId;
      if (!organizationId) return next(new AppError('Organization context required', 400));
      const loan = await loanService.disburse(req.params.id, organizationId);
      return res.json({ success: true, data: loan, message: 'Loan disbursed successfully' });
    } catch (error) {
      return next(error);
    }
  }

  async rejectLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId;
      if (!organizationId) return next(new AppError('Organization context required', 400));
      const loan = await loanService.reject(req.params.id, organizationId);
      return res.json({ success: true, data: loan, message: 'Loan rejected' });
    } catch (error) {
      return next(error);
    }
  }

  async recordRepayment(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).rbac?.organizationId;
      if (!organizationId) return next(new AppError('Organization context required', 400));
      const parsed = recordRepaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new AppError(parsed.error.errors[0]?.message || 'Validation error', 400));
      }
      const result = await loanService.recordRepayment(req.params.id, organizationId, parsed.data);
      return res.json({ success: true, data: result, message: 'Repayment recorded successfully' });
    } catch (error) {
      return next(error);
    }
  }
}

export const loanController = new LoanController();
