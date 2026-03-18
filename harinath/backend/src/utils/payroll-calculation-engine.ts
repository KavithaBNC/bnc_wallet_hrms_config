/**
 * Payroll Calculation Engine
 * Module 2: Payroll Processing
 * 
 * Handles all payroll calculations including:
 * - Gross salary calculation from components
 * - Deductions (PF, ESI, Tax, PT, Others)
 * - LOP (Loss of Pay) calculation
 * - Leave integration (paid vs unpaid)
 * - Overtime calculation
 * - Pro-rata salary (mid-month joining/leaving)
 * - Tax calculation (India: Old vs New regime)
 */

import { Prisma } from '@prisma/client';
import { SalaryComponent, calculateComponentValue, getTaxableIncome } from './salary-components';

// ============================================================================
// Types
// ============================================================================

export interface AttendanceData {
  presentDays: number;
  absentDays: number;
  halfDays: number;
  holidayDays: number;
  weekendDays: number;
  overtimeHours: number;
  totalWorkingDays: number;
}

export interface LeaveData {
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  leaveDetails: Array<{
    leaveType: string;
    days: number;
    isPaid: boolean;
  }>;
}

export interface EmployeePeriodData {
  employeeId: string;
  joiningDate?: Date;
  leavingDate?: Date;
  periodStart: Date;
  periodEnd: Date;
  attendance: AttendanceData;
  leaves: LeaveData;
}

export interface PayrollCalculationResult {
  // Basic amounts
  basicSalary: number;
  grossSalary: number;
  netSalary: number;
  
  // Earnings breakdown
  earnings: Array<{
    component: string;
    amount: number;
    isTaxable: boolean;
  }>;
  
  // Deductions breakdown
  deductions: Array<{
    component: string;
    amount: number;
    type: string;
  }>;
  
  // Attendance adjustments
  lopAmount: number; // Loss of Pay
  overtimeAmount: number;
  
  // Tax details
  taxDetails: {
    taxableIncome: number;
    incomeTax: number;
    regime: 'OLD' | 'NEW';
    breakdown: Array<{
      slab: string;
      rate: number;
      amount: number;
    }>;
  };
  
  // Statutory deductions
  statutoryDeductions: {
    pf: number;
    esi: number;
    professionalTax: number;
    total: number;
    breakdown: Array<{
      type: string;
      amount: number;
    }>;
  };
  
  // Pro-rata information
  prorationFactor: number;
  paidDays: number;
  totalWorkingDays: number;
  
  // Summary
  totalEarnings: number;
  totalDeductions: number;
}

// ============================================================================
// Calculation Engine
// ============================================================================

export class PayrollCalculationEngine {
  /** Map attendance columnKey -> salary component name (from post_to_payroll_mappings) */
  static resolveComponentName(
    columnKey: string,
    mappings: Array<{ columnKey: string; elementMapping: string | null }>,
    fallback: string
  ): string {
    const m = mappings.find((x) => x.columnKey === columnKey);
    return (m?.elementMapping?.trim() || fallback);
  }

  /**
   * Calculate payroll for an employee
   */
  static calculatePayroll(
    employeeSalary: {
      basicSalary: number | Prisma.Decimal;
      grossSalary: number | Prisma.Decimal;
      netSalary: number | Prisma.Decimal;
      components: any;
      currency: string;
      paymentFrequency: string;
    },
    salaryStructureComponents: SalaryComponent[],
    periodData: EmployeePeriodData,
    taxRegime: 'OLD' | 'NEW' = 'NEW',
    _organizationId: string,
    /** From post_to_payroll_mappings: [{ columnKey, elementMapping }] – used for OT, LOP component names */
    attendanceMappings?: Array<{ columnKey: string; elementMapping: string | null }>
  ): PayrollCalculationResult {
    const basicSalary = Number(employeeSalary.basicSalary);
    const grossSalary = Number(employeeSalary.grossSalary);
    
    // Calculate pro-rata factor for mid-month joining/leaving
    const prorationFactor = this.calculateProrationFactor(
      periodData.periodStart,
      periodData.periodEnd,
      periodData.attendance.totalWorkingDays,
      periodData.joiningDate,
      periodData.leavingDate
    );
    
    // Calculate paid days (considering attendance and leaves)
    const paidDays = this.calculatePaidDays(
      periodData.attendance,
      periodData.leaves,
      periodData.attendance.totalWorkingDays
    );
    
    // Calculate LOP (Loss of Pay)
    const lopAmount = this.calculateLOP(
      grossSalary,
      periodData.attendance.totalWorkingDays,
      periodData.attendance.absentDays,
      periodData.leaves.unpaidLeaveDays
    );
    
    // Calculate overtime amount
    const overtimeAmount = this.calculateOvertime(
      basicSalary,
      periodData.attendance.overtimeHours,
      periodData.attendance.totalWorkingDays
    );
    
    // Calculate earnings from components
    const earnings = this.calculateEarnings(
      salaryStructureComponents.filter(c => c.type === 'EARNING'),
      basicSalary,
      prorationFactor,
      paidDays,
      periodData.attendance.totalWorkingDays,
      employeeSalary.components
    );
    
    // Add overtime to earnings (use mapped component name from post_to_payroll_mappings)
    if (overtimeAmount > 0) {
      const otName = this.resolveComponentName('overtimeHours', attendanceMappings || [], 'Overtime');
      earnings.push({
        component: otName,
        amount: overtimeAmount,
        isTaxable: true,
      });
    }
    
    // Calculate gross salary from earnings
    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const adjustedGrossSalary = totalEarnings - lopAmount;
    
    // Calculate the actual proration factor used in earnings (for consistency)
    // This ensures basicSalary matches what's shown in earnings breakdown
    const paidDaysFactor = periodData.attendance.totalWorkingDays > 0 
      ? paidDays / periodData.attendance.totalWorkingDays 
      : 0;
    const actualProrationFactor = prorationFactor > 0 
      ? prorationFactor * paidDaysFactor 
      : paidDaysFactor;
    
    // Use the same factor for basicSalary as used in earnings
    const proratedBasicSalary = basicSalary * actualProrationFactor;
    
    // Calculate taxable income
    const taxableIncome = getTaxableIncome(
      salaryStructureComponents.filter(c => c.type === 'EARNING'),
      basicSalary
    ) * actualProrationFactor - lopAmount;
    
    // Calculate deductions
    const deductions = this.calculateDeductions(
      salaryStructureComponents.filter(c => c.type === 'DEDUCTION'),
      adjustedGrossSalary,
      proratedBasicSalary,
      taxableIncome,
      employeeSalary.components,
      prorationFactor,
      paidDays,
      periodData.attendance.totalWorkingDays
    );
    
    // Calculate tax
    const taxDetails = this.calculateIncomeTax(taxableIncome, taxRegime);
    
    // Calculate statutory deductions
    const statutoryDeductions = this.calculateStatutoryDeductions(
      adjustedGrossSalary,
      proratedBasicSalary,
      _organizationId
    );
    
    // Add statutory deductions to total deductions
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0) +
      taxDetails.incomeTax +
      statutoryDeductions.total;
    
    // Calculate net salary
    const finalNetSalary = adjustedGrossSalary - totalDeductions;
    
    return {
      basicSalary: proratedBasicSalary, // Use same factor as earnings
      grossSalary: adjustedGrossSalary,
      netSalary: finalNetSalary,
      earnings,
      deductions,
      lopAmount,
      overtimeAmount,
      taxDetails,
      statutoryDeductions,
      prorationFactor,
      paidDays,
      totalWorkingDays: periodData.attendance.totalWorkingDays,
      totalEarnings,
      totalDeductions,
    };
  }
  
  /**
   * Calculate pro-rata factor for mid-month joining/leaving
   */
  static calculateProrationFactor(
    periodStart: Date,
    periodEnd: Date,
    totalWorkingDays: number,
    joiningDate?: Date,
    leavingDate?: Date
  ): number {
    let effectiveStart = periodStart;
    let effectiveEnd = periodEnd;
    
    // Adjust for mid-month joining
    // Only adjust if joining date is within the period
    if (joiningDate) {
      if (joiningDate > periodEnd) {
        // Employee joined after period - should not be in payroll, but if they are, use full period
        // Return 1.0 to use full period (this case should be handled upstream)
        return 1.0;
      } else if (joiningDate > periodStart) {
        effectiveStart = joiningDate;
      }
    }
    
    // Adjust for mid-month leaving
    // Only adjust if leaving date is within the period
    if (leavingDate) {
      if (leavingDate < periodStart) {
        // Employee left before period - should not be in payroll, but if they are, use full period
        return 1.0;
      } else if (leavingDate < periodEnd) {
        effectiveEnd = leavingDate;
      }
    }
    
    // Ensure effective period is valid
    if (effectiveStart > effectiveEnd) {
      // Invalid period - return 0 (should not happen, but handle gracefully)
      return 0;
    }
    
    // Calculate working days in effective period
    const effectiveWorkingDays = this.calculateWorkingDays(effectiveStart, effectiveEnd);
    
    return totalWorkingDays > 0 ? effectiveWorkingDays / totalWorkingDays : 0;
  }
  
  /**
   * Calculate working days between two dates (excluding weekends)
   */
  static calculateWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday or Saturday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }
  
  /**
   * Calculate paid days considering attendance and leaves
   */
  static calculatePaidDays(
    attendance: AttendanceData,
    leaves: LeaveData,
    totalWorkingDays: number
  ): number {
    // Start with present days
    let paidDays = attendance.presentDays;
    
    // Add half days (count as 0.5)
    paidDays += attendance.halfDays * 0.5;
    
    // Add paid leave days
    paidDays += leaves.paidLeaveDays;
    
    // Holidays are already paid
    paidDays += attendance.holidayDays;
    
    return Math.min(paidDays, totalWorkingDays);
  }
  
  /**
   * Calculate LOP (Loss of Pay) for absent days and unpaid leaves
   */
  static calculateLOP(
    monthlySalary: number,
    totalWorkingDays: number,
    absentDays: number,
    unpaidLeaveDays: number
  ): number {
    if (totalWorkingDays === 0) return 0;
    
    const dailySalary = monthlySalary / totalWorkingDays;
    const totalUnpaidDays = absentDays + unpaidLeaveDays;
    
    return dailySalary * totalUnpaidDays;
  }
  
  /**
   * Calculate overtime amount
   */
  static calculateOvertime(
    basicSalary: number,
    overtimeHours: number,
    totalWorkingDays: number
  ): number {
    if (totalWorkingDays === 0 || overtimeHours === 0) return 0;
    
    // Calculate hourly rate (assuming 8 hours per day)
    const dailySalary = basicSalary / totalWorkingDays;
    const hourlyRate = dailySalary / 8;
    
    // Overtime is typically 1.5x or 2x the hourly rate
    const overtimeRate = hourlyRate * 1.5; // 1.5x for overtime
    
    return overtimeRate * overtimeHours;
  }
  
  /**
   * Calculate earnings from components
   */
  static calculateEarnings(
    earningComponents: SalaryComponent[],
    basicSalary: number,
    prorationFactor: number,
    paidDays: number,
    totalWorkingDays: number,
    actualComponents: any
  ): Array<{ component: string; amount: number; isTaxable: boolean }> {
    const earnings: Array<{ component: string; amount: number; isTaxable: boolean }> = [];
    
    // Calculate paid days factor
    const paidDaysFactor = totalWorkingDays > 0 ? paidDays / totalWorkingDays : 0;
    
    // Determine the factor to use for calculation
    // Priority: Use paidDaysFactor if we have paid days, otherwise use prorationFactor
    // This ensures we don't get 0 when employee worked during the period
    let finalProrationFactor = 0;
    if (paidDays > 0 && totalWorkingDays > 0) {
      // Employee worked during period - use paid days factor
      finalProrationFactor = prorationFactor > 0 ? prorationFactor * paidDaysFactor : paidDaysFactor;
    } else if (prorationFactor > 0) {
      // No paid days but proration factor exists (e.g., mid-month joining)
      finalProrationFactor = prorationFactor;
    } else {
      // Fallback: use paidDaysFactor even if 0
      finalProrationFactor = paidDaysFactor;
    }
    
    // Calculate basic salary amount
    const basicAmount = basicSalary * finalProrationFactor;
    
    earnings.push({
      component: 'Basic Salary',
      amount: Math.max(0, basicAmount), // Ensure non-negative
      isTaxable: true,
    });
    
    // Calculate other earnings from components
    for (const component of earningComponents) {
      if (component.code === 'BASIC' || component.name.toLowerCase().includes('basic')) {
        continue; // Already added
      }
      
      // Get component value from actual components or calculate from structure
      let componentValue = 0;
      if (actualComponents && (actualComponents[component.code || component.name] !== undefined)) {
        componentValue = actualComponents[component.code || component.name];
      } else {
        // Calculate from component definition
        componentValue = calculateComponentValue(component, basicSalary, { 
          basicSalary, 
          grossSalary: basicSalary 
        });
      }
      
      // Use same proration factor as basic salary
      const amount = componentValue * finalProrationFactor;
      
      if (amount > 0) {
        earnings.push({
          component: component.name,
          amount: Math.max(0, amount), // Ensure non-negative
          isTaxable: component.isTaxable,
        });
      }
    }
    
    return earnings;
  }
  
  /**
   * Calculate deductions from components
   */
  static calculateDeductions(
    deductionComponents: SalaryComponent[],
    grossSalary: number,
    basicSalary: number,
    taxableIncome: number,
    actualComponents: any,
    prorationFactor: number,
    paidDays: number,
    totalWorkingDays: number
  ): Array<{ component: string; amount: number; type: string }> {
    const deductions: Array<{ component: string; amount: number; type: string }> = [];
    
    // Calculate paid days factor
    const paidDaysFactor = totalWorkingDays > 0 ? paidDays / totalWorkingDays : 0;
    const finalProrationFactor = prorationFactor * paidDaysFactor;
    
    for (const component of deductionComponents) {
      // Get component value from actual components or calculate from structure
      let componentValue = 0;
      if (actualComponents && (actualComponents[component.code || component.name] !== undefined)) {
        componentValue = actualComponents[component.code || component.name];
      } else {
        // Calculate from component definition
        componentValue = calculateComponentValue(component, grossSalary, { 
          grossSalary, 
          basicSalary, 
          taxableIncome 
        });
      }
      
      const amount = componentValue * finalProrationFactor;
      
      if (amount > 0) {
        deductions.push({
          component: component.name,
          amount,
          type: component.isStatutory ? 'STATUTORY' : 'NON_STATUTORY',
        });
      }
    }
    
    return deductions;
  }
  
  /**
   * Calculate income tax (India: Old vs New regime)
   */
  static calculateIncomeTax(taxableIncome: number, regime: 'OLD' | 'NEW'): {
    taxableIncome: number;
    incomeTax: number;
    regime: 'OLD' | 'NEW';
    breakdown: Array<{ slab: string; rate: number; amount: number }>;
  } {
    if (regime === 'NEW') {
      return this.calculateNewTaxRegime(taxableIncome);
    } else {
      return this.calculateOldTaxRegime(taxableIncome);
    }
  }
  
  /**
   * Calculate tax under New Tax Regime (FY 2023-24)
   */
  static calculateNewTaxRegime(taxableIncome: number): {
    taxableIncome: number;
    incomeTax: number;
    regime: 'NEW';
    breakdown: Array<{ slab: string; rate: number; amount: number }>;
  } {
    const breakdown: Array<{ slab: string; rate: number; amount: number }> = [];
    let remainingIncome = taxableIncome;
    let totalTax = 0;
    
    // New Tax Regime Slabs (FY 2023-24)
    const slabs = [
      { min: 0, max: 300000, rate: 0 },
      { min: 300000, max: 700000, rate: 5 },
      { min: 700000, max: 1000000, rate: 10 },
      { min: 1000000, max: 1200000, rate: 15 },
      { min: 1200000, max: 1500000, rate: 20 },
      { min: 1500000, max: Infinity, rate: 30 },
    ];
    
    for (const slab of slabs) {
      if (remainingIncome <= 0) break;
      
      const slabIncome = Math.min(remainingIncome, slab.max - slab.min);
      if (slabIncome <= 0) continue;
      
      const taxOnSlab = (slabIncome * slab.rate) / 100;
      totalTax += taxOnSlab;
      
      breakdown.push({
        slab: `₹${slab.min.toLocaleString()} - ₹${slab.max === Infinity ? '∞' : slab.max.toLocaleString()}`,
        rate: slab.rate,
        amount: taxOnSlab,
      });
      
      remainingIncome -= slabIncome;
    }
    
    // Add cess (4% of tax)
    const cess = totalTax * 0.04;
    totalTax += cess;
    
    return {
      taxableIncome,
      incomeTax: totalTax,
      regime: 'NEW',
      breakdown,
    };
  }
  
  /**
   * Calculate tax under Old Tax Regime (FY 2023-24)
   */
  static calculateOldTaxRegime(taxableIncome: number): {
    taxableIncome: number;
    incomeTax: number;
    regime: 'OLD';
    breakdown: Array<{ slab: string; rate: number; amount: number }>;
  } {
    const breakdown: Array<{ slab: string; rate: number; amount: number }> = [];
    let remainingIncome = taxableIncome;
    let totalTax = 0;
    
    // Old Tax Regime Slabs (FY 2023-24)
    // Note: Standard deduction of ₹50,000 and other deductions are assumed to be already applied
    const slabs = [
      { min: 0, max: 250000, rate: 0 },
      { min: 250000, max: 500000, rate: 5 },
      { min: 500000, max: 1000000, rate: 20 },
      { min: 1000000, max: Infinity, rate: 30 },
    ];
    
    for (const slab of slabs) {
      if (remainingIncome <= 0) break;
      
      const slabIncome = Math.min(remainingIncome, slab.max - slab.min);
      if (slabIncome <= 0) continue;
      
      const taxOnSlab = (slabIncome * slab.rate) / 100;
      totalTax += taxOnSlab;
      
      breakdown.push({
        slab: `₹${slab.min.toLocaleString()} - ₹${slab.max === Infinity ? '∞' : slab.max.toLocaleString()}`,
        rate: slab.rate,
        amount: taxOnSlab,
      });
      
      remainingIncome -= slabIncome;
    }
    
    // Add cess (4% of tax)
    const cess = totalTax * 0.04;
    totalTax += cess;
    
    return {
      taxableIncome,
      incomeTax: totalTax,
      regime: 'OLD',
      breakdown,
    };
  }
  
  /**
   * Calculate statutory deductions (PF, ESI, Professional Tax)
   */
  static calculateStatutoryDeductions(
    grossSalary: number,
    basicSalary: number,
    _organizationId: string
  ): {
    pf: number;
    esi: number;
    professionalTax: number;
    total: number;
    breakdown: Array<{ type: string; amount: number }>;
  } {
    const breakdown: Array<{ type: string; amount: number }> = [];
    
    // PF: 12% of (Basic + DA) - typically 12% of Basic
    const pf = (basicSalary * 12) / 100;
    breakdown.push({ type: 'Provident Fund (PF)', amount: pf });
    
    // ESI: 0.75% of Gross (if gross < ₹21,000 threshold)
    const esi = grossSalary < 21000 ? (grossSalary * 0.75) / 100 : 0;
    if (esi > 0) {
      breakdown.push({ type: 'Employee State Insurance (ESI)', amount: esi });
    }
    
    // Professional Tax: Varies by state (simplified: ₹200 per month)
    const professionalTax = 200;
    breakdown.push({ type: 'Professional Tax', amount: professionalTax });
    
    const total = pf + esi + professionalTax;
    
    return {
      pf,
      esi,
      professionalTax,
      total,
      breakdown,
    };
  }
}
