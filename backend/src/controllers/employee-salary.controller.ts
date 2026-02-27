import { Request, Response, NextFunction } from 'express';
import { employeeSalaryService } from '../services/employee-salary.service';
import {
  createEmployeeSalarySchema,
  updateEmployeeSalarySchema,
  queryEmployeeSalariesSchema,
  createBankAccountSchema,
  updateBankAccountSchema,
} from '../utils/payroll.validation';

export class EmployeeSalaryController {
  /**
   * Create employee salary
   */
  async createSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createEmployeeSalarySchema.parse(req.body);
      const salary = await employeeSalaryService.createSalary(data);
      res.status(201).json({
        success: true,
        data: salary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all employee salaries
   */
  async getAllSalaries(req: Request, res: Response, next: NextFunction) {
    try {
      const query = queryEmployeeSalariesSchema.parse(req.query);
      const result = await employeeSalaryService.getAllSalaries(query);
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get employee salary by ID
   */
  async getSalaryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const salary = await employeeSalaryService.getSalaryById(id);
      res.json({
        success: true,
        data: salary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current active salary for employee
   */
  async getCurrentSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const salary = await employeeSalaryService.getCurrentSalary(employeeId);
      res.json({
        success: true,
        data: salary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update employee salary
   */
  async updateSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateEmployeeSalarySchema.parse(req.body);
      const salary = await employeeSalaryService.updateSalary(id, data);
      res.json({
        success: true,
        data: salary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create bank account
   */
  async createBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createBankAccountSchema.parse(req.body);
      const bankAccount = await employeeSalaryService.createBankAccount(data);
      res.status(201).json({
        success: true,
        data: bankAccount,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bank accounts for employee
   */
  async getBankAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId } = req.params;
      const bankAccounts = await employeeSalaryService.getBankAccounts(employeeId);
      res.json({
        success: true,
        data: bankAccounts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update bank account
   */
  async updateBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateBankAccountSchema.parse(req.body);
      const bankAccount = await employeeSalaryService.updateBankAccount(id, data);
      res.json({
        success: true,
        data: bankAccount,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await employeeSalaryService.deleteBankAccount(id);
      res.json({
        success: true,
        message: 'Bank account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const employeeSalaryController = new EmployeeSalaryController();
