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
import { decryptField } from './crypto-utils';
import { SalaryComponent, calculateComponentValue, getTaxableIncome } from './salary-components';
import type {
  FullStatutoryConfig,
  PfConfig,
  EsiConfig,
  PtSlabConfig,
  TdsSlabConfig,
  StandardDeductionConfig,
  RebateConfig,
} from '../services/statutory-config.service';
import { resolvePtaxStateKey } from '../services/statutory-config.service';

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
    panStatus: 'VALID' | 'MISSING' | 'INVALID';
    higherTdsApplied: boolean;
    breakdown: Array<{
      slab: string;
      rate: number;
      amount: number;
    }>;
  };

  // Statutory deductions
  statutoryDeductions: {
    pf: number;
    employerEpf: number;
    employerEps: number;
    employerEdli: number;
    employerAdmin: number;
    esi: number;
    employerEsi: number;
    professionalTax: number;
    total: number;
    employerTotal: number;
    breakdown: Array<{
      type: string;
      amount: number;
      side: 'employee' | 'employer';
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
// PAN Validation
// ============================================================================

/** Validate PAN format: AAAAA0000A (5 letters, 4 digits, 1 letter) */
export function validatePAN(pan?: string | null): 'VALID' | 'MISSING' | 'INVALID' {
  if (!pan || pan.trim().length === 0) return 'MISSING';
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.trim().toUpperCase()) ? 'VALID' : 'INVALID';
}

/** Higher TDS rate (20%) applied when PAN is missing/invalid per Section 206AA */
const HIGHER_TDS_RATE = 0.20;

// ============================================================================
// HRA Calculation (Section 10(13A))
// ============================================================================

export interface HRAInput {
  basicSalary: number;
  hraReceived: number;
  rentPaid: number;
  isMetroCity: boolean; // Delhi, Mumbai, Kolkata, Chennai
}

/**
 * Calculate HRA exemption under Section 10(13A) of IT Act
 * Exempt = Minimum of:
 *   1. Actual HRA received
 *   2. Rent paid - 10% of Basic
 *   3. 50% of Basic (metro) or 40% of Basic (non-metro)
 */
export function calculateHRAExemption(input: HRAInput): {
  exemption: number;
  taxableHRA: number;
} {
  const { basicSalary, hraReceived, rentPaid, isMetroCity } = input;

  if (hraReceived <= 0 || rentPaid <= 0) {
    return { exemption: 0, taxableHRA: hraReceived };
  }

  const actualHRA = hraReceived;
  const rentMinusBasic = Math.max(0, rentPaid - (basicSalary * 0.10));
  const percentOfBasic = basicSalary * (isMetroCity ? 0.50 : 0.40);

  const exemption = Math.min(actualHRA, rentMinusBasic, percentOfBasic);
  const taxableHRA = Math.max(0, hraReceived - exemption);

  return { exemption, taxableHRA };
}

// ============================================================================
// Bonus Calculation (Payment of Bonus Act, 1965)
// ============================================================================

/** Statutory bonus: minimum 8.33%, maximum 20% of Basic */
export function calculateStatutoryBonus(
  basicSalary: number,
  bonusPercentage: number = 8.33
): number {
  const rate = Math.max(8.33, Math.min(bonusPercentage, 20));
  return Math.round((basicSalary * rate) / 100);
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
    attendanceMappings?: Array<{ columnKey: string; elementMapping: string | null }>,
    /** Employee's state for PT calculation (e.g., 'TAMIL_NADU', 'MAHARASHTRA') */
    state?: string,
    /** Tax declarations for OLD regime deductions */
    taxDeclarations?: {
      section80C?: number;
      section80D?: number;
      section80CCD?: number;
      hraExemption?: number;
    },
    /** YTD tax already paid (for monthly TDS projection adjustment) */
    ytdTaxPaid?: number,
    /** Current payroll month (1-12) — used for Maharashtra Feb PT adjustment */
    payrollMonth?: number,
    /** DB-driven statutory configuration (PF, ESI, PT, TDS, etc.) */
    statutoryConfig?: FullStatutoryConfig,
    /** Employee PAN number for TDS validation (Section 206AA) */
    panNumber?: string | null,
    /** Overtime rate multiplier (default 1.5x) — configurable per organization */
    overtimeMultiplier?: number
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
    
    // Calculate overtime amount (with configurable multiplier)
    const overtimeAmount = this.calculateOvertime(
      basicSalary,
      periodData.attendance.overtimeHours,
      periodData.attendance.totalWorkingDays,
      overtimeMultiplier
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
    
    // Validate PAN for TDS (Section 206AA: higher TDS if PAN missing/invalid)
    // Decrypt first in case PAN is stored encrypted in DB
    const panStatus = validatePAN(decryptField(panNumber) as string | undefined);
    let higherTdsApplied = false;

    // Calculate tax (with standard deduction and 80C/80D for OLD regime)
    let taxDetails = this.calculateMonthlyTDS(
      taxableIncome,
      taxRegime,
      taxDeclarations,
      ytdTaxPaid,
      statutoryConfig?.standardDeduction,
      taxRegime === 'NEW' ? statutoryConfig?.tdsNew : statutoryConfig?.tdsOld,
      statutoryConfig?.rebate
    );

    // Section 206AA: If PAN is missing/invalid, apply higher TDS rate of 20%
    if (panStatus !== 'VALID' && taxableIncome > 0) {
      const higherTDS = Math.round((taxableIncome * HIGHER_TDS_RATE) / 12);
      if (higherTDS > taxDetails.incomeTax) {
        taxDetails = {
          ...taxDetails,
          incomeTax: higherTDS,
        };
        higherTdsApplied = true;
      }
    }

    // Calculate statutory deductions
    const statutoryDeductions = this.calculateStatutoryDeductions(
      adjustedGrossSalary,
      proratedBasicSalary,
      _organizationId,
      state,
      payrollMonth,
      statutoryConfig?.pf,
      statutoryConfig?.esi,
      state ? statutoryConfig?.pt[resolvePtaxStateKey(state) ?? state.toUpperCase().replace(/\s+/g, '_')] : undefined
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
      taxDetails: {
        ...taxDetails,
        panStatus,
        higherTdsApplied,
      },
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
   * @param overtimeMultiplier - Configurable OT rate multiplier (default 1.5x per Factories Act, 1948)
   */
  static calculateOvertime(
    basicSalary: number,
    overtimeHours: number,
    totalWorkingDays: number,
    overtimeMultiplier: number = 1.5
  ): number {
    if (totalWorkingDays === 0 || overtimeHours === 0) return 0;

    // Calculate hourly rate (assuming 8 hours per day)
    const dailySalary = basicSalary / totalWorkingDays;
    const hourlyRate = dailySalary / 8;

    // Overtime rate: configurable multiplier (default 1.5x per Factories Act; 2x is also common)
    const overtimeRate = hourlyRate * overtimeMultiplier;

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
      
      // Flat components (e.g. variable inputs) are paid as-is; others use the proration factor
      const amount = component.isFlat ? componentValue : componentValue * finalProrationFactor;

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
      
      // Flat components (e.g. variable deductions) are applied as-is; others use the proration factor
      const amount = component.isFlat ? componentValue : componentValue * finalProrationFactor;

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
   * Calculate tax under New Tax Regime (FY 2025-26 — Union Budget 2025)
   * Accepts optional DB-driven TDS slab config and rebate config.
   */
  static calculateNewTaxRegime(
    taxableIncome: number,
    tdsConfig?: TdsSlabConfig,
    rebateConfig?: RebateConfig
  ): {
    taxableIncome: number;
    incomeTax: number;
    regime: 'NEW';
    breakdown: Array<{ slab: string; rate: number; amount: number }>;
  } {
    const breakdown: Array<{ slab: string; rate: number; amount: number }> = [];
    let remainingIncome = taxableIncome;
    let totalTax = 0;

    // Slabs from DB config or hardcoded defaults
    const slabs = tdsConfig?.slabs ?? [
      { min: 0, max: 400000, rate: 0 },
      { min: 400000, max: 800000, rate: 5 },
      { min: 800000, max: 1200000, rate: 10 },
      { min: 1200000, max: 1600000, rate: 15 },
      { min: 1600000, max: 2000000, rate: 20 },
      { min: 2000000, max: 2400000, rate: 25 },
      { min: 2400000, max: null as number | null, rate: 30 },
    ];
    const cessRate = tdsConfig?.cessRate ?? 4;

    for (const slab of slabs) {
      if (remainingIncome <= 0) break;
      const slabMax = slab.max === null ? Infinity : slab.max;

      const slabIncome = Math.min(remainingIncome, slabMax - slab.min);
      if (slabIncome <= 0) continue;

      const taxOnSlab = (slabIncome * slab.rate) / 100;
      totalTax += taxOnSlab;

      breakdown.push({
        slab: `₹${slab.min.toLocaleString()} - ₹${slabMax === Infinity ? '∞' : slabMax.toLocaleString()}`,
        rate: slab.rate,
        amount: taxOnSlab,
      });

      remainingIncome -= slabIncome;
    }

    // Rebate u/s 87A (from config or defaults)
    const maxRebate = rebateConfig?.maxRebate ?? 60000;
    const incomeLimit = rebateConfig?.incomeLimit ?? 1200000;
    if (taxableIncome <= incomeLimit) {
      const rebate = Math.min(totalTax, maxRebate);
      totalTax = Math.max(0, totalTax - rebate);
    }

    // Add cess
    const cess = totalTax * (cessRate / 100);
    totalTax += cess;

    return {
      taxableIncome,
      incomeTax: totalTax,
      regime: 'NEW',
      breakdown,
    };
  }

  /**
   * Calculate tax under Old Tax Regime
   * Accepts optional DB-driven TDS slab config.
   */
  static calculateOldTaxRegime(
    taxableIncome: number,
    tdsConfig?: TdsSlabConfig
  ): {
    taxableIncome: number;
    incomeTax: number;
    regime: 'OLD';
    breakdown: Array<{ slab: string; rate: number; amount: number }>;
  } {
    const breakdown: Array<{ slab: string; rate: number; amount: number }> = [];
    let remainingIncome = taxableIncome;
    let totalTax = 0;

    const slabs = tdsConfig?.slabs ?? [
      { min: 0, max: 250000, rate: 0 },
      { min: 250000, max: 500000, rate: 5 },
      { min: 500000, max: 1000000, rate: 20 },
      { min: 1000000, max: null as number | null, rate: 30 },
    ];
    const cessRate = tdsConfig?.cessRate ?? 4;

    for (const slab of slabs) {
      if (remainingIncome <= 0) break;
      const slabMax = slab.max === null ? Infinity : slab.max;

      const slabIncome = Math.min(remainingIncome, slabMax - slab.min);
      if (slabIncome <= 0) continue;

      const taxOnSlab = (slabIncome * slab.rate) / 100;
      totalTax += taxOnSlab;

      breakdown.push({
        slab: `₹${slab.min.toLocaleString()} - ₹${slabMax === Infinity ? '∞' : slabMax.toLocaleString()}`,
        rate: slab.rate,
        amount: taxOnSlab,
      });

      remainingIncome -= slabIncome;
    }

    // Add cess
    const cess = totalTax * (cessRate / 100);
    totalTax += cess;

    return {
      taxableIncome,
      incomeTax: totalTax,
      regime: 'OLD',
      breakdown,
    };
  }
  
  /**
   * Calculate Professional Tax based on state and gross salary
   */
  static calculateProfessionalTax(
    grossSalary: number,
    _state?: string,
    month?: number,
    ptConfig?: PtSlabConfig
  ): number {
    if (ptConfig) {
      // Use DB-driven config
      // Check specialMonths (e.g., Maharashtra February)
      if (ptConfig.specialMonths && month !== undefined) {
        const specialTax = ptConfig.specialMonths[String(month)];
        if (specialTax !== undefined && grossSalary > (ptConfig.slabs[0]?.maxSalary ?? 0)) {
          return specialTax;
        }
      }

      for (const slab of ptConfig.slabs) {
        const maxSalary = slab.maxSalary === null ? Infinity : slab.maxSalary;
        if (grossSalary <= maxSalary) {
          return slab.tax;
        }
      }
      return ptConfig.defaultTax;
    }

    // Fallback: no config provided → default ₹200/month
    return 200;
  }

  /**
   * Calculate statutory deductions (PF, ESI, Professional Tax)
   * Compliant with Indian EPF/ESI/PT regulations.
   * Accepts optional DB-driven configs; falls back to hardcoded defaults.
   */
  static calculateStatutoryDeductions(
    grossSalary: number,
    basicSalary: number,
    _organizationId: string,
    state?: string,
    payrollMonth?: number,
    pfConfig?: PfConfig,
    esiConfig?: EsiConfig,
    ptConfig?: PtSlabConfig
  ): {
    pf: number;
    employerEpf: number;
    employerEps: number;
    employerEdli: number;
    employerAdmin: number;
    esi: number;
    employerEsi: number;
    professionalTax: number;
    total: number;
    employerTotal: number;
    breakdown: Array<{ type: string; amount: number; side: 'employee' | 'employer' }>;
  } {
    const breakdown: Array<{ type: string; amount: number; side: 'employee' | 'employer' }> = [];

    // ---- PF (Provident Fund) ----
    const wageCeiling = pfConfig?.wageCeiling ?? 15000;
    const eeRate = pfConfig?.employeeRate ?? 12;
    const epsRate = pfConfig?.employerEpsRate ?? 8.33;
    const epfRate = pfConfig?.employerEpfRate ?? 3.67;
    const edliRate = pfConfig?.edliRate ?? 0.5;
    const adminRate = pfConfig?.adminChargeRate ?? 0.5;

    const pfWage = Math.min(basicSalary, wageCeiling);

    const pf = Math.round((pfWage * eeRate) / 100);
    breakdown.push({ type: 'Provident Fund (Employee)', amount: pf, side: 'employee' });

    const employerEps = Math.round((pfWage * epsRate) / 100);
    const employerEpf = Math.round((pfWage * epfRate) / 100);
    const employerEdli = Math.round((pfWage * edliRate) / 100);
    const employerAdmin = Math.round((pfWage * adminRate) / 100);

    breakdown.push({ type: 'EPF (Employer)', amount: employerEpf, side: 'employer' });
    breakdown.push({ type: 'EPS (Employer)', amount: employerEps, side: 'employer' });
    breakdown.push({ type: 'EDLI (Employer)', amount: employerEdli, side: 'employer' });
    breakdown.push({ type: 'PF Admin Charges', amount: employerAdmin, side: 'employer' });

    // ---- ESI (Employee State Insurance) ----
    const esiThreshold = esiConfig?.grossThreshold ?? 21000;
    const esiEeRate = esiConfig?.employeeRate ?? 0.75;
    const esiErRate = esiConfig?.employerRate ?? 3.25;

    const esi = grossSalary < esiThreshold
      ? Math.round((grossSalary * esiEeRate) / 100)
      : 0;
    const employerEsi = grossSalary < esiThreshold
      ? Math.round((grossSalary * esiErRate) / 100)
      : 0;

    if (esi > 0) {
      breakdown.push({ type: 'ESI (Employee)', amount: esi, side: 'employee' });
    }
    if (employerEsi > 0) {
      breakdown.push({ type: 'ESI (Employer)', amount: employerEsi, side: 'employer' });
    }

    // ---- Professional Tax ----
    const professionalTax = this.calculateProfessionalTax(grossSalary, state, payrollMonth, ptConfig);
    if (professionalTax > 0) {
      breakdown.push({ type: 'Professional Tax', amount: professionalTax, side: 'employee' });
    }

    // Employee-side total (deducted from salary)
    const total = pf + esi + professionalTax;
    // Employer-side total (company cost, not deducted from employee salary)
    const employerTotal = employerEpf + employerEps + employerEdli + employerAdmin + employerEsi;

    return {
      pf,
      employerEpf,
      employerEps,
      employerEdli,
      employerAdmin,
      esi,
      employerEsi,
      professionalTax,
      total,
      employerTotal,
      breakdown,
    };
  }

  /**
   * Calculate monthly TDS (Tax Deducted at Source) with projection
   * Projects annual income, applies standard deduction and declarations,
   * calculates annual tax, then derives monthly TDS.
   * Accepts optional DB-driven configs; falls back to hardcoded defaults.
   */
  static calculateMonthlyTDS(
    monthlyTaxableIncome: number,
    regime: 'OLD' | 'NEW',
    taxDeclarations?: {
      section80C?: number;
      section80D?: number;
      section80CCD?: number;
      hraExemption?: number;
    },
    ytdTaxPaid?: number,
    stdDeductionConfig?: StandardDeductionConfig,
    tdsConfig?: TdsSlabConfig,
    rebateConfig?: RebateConfig
  ): {
    taxableIncome: number;
    incomeTax: number;
    regime: 'OLD' | 'NEW';
    breakdown: Array<{ slab: string; rate: number; amount: number }>;
  } {
    // Project annual taxable income
    let annualTaxableIncome = monthlyTaxableIncome * 12;

    // Apply standard deduction (from config or defaults)
    const standardDeduction = regime === 'NEW'
      ? (stdDeductionConfig?.NEW ?? 75000)
      : (stdDeductionConfig?.OLD ?? 50000);
    annualTaxableIncome = Math.max(0, annualTaxableIncome - standardDeduction);

    // Apply tax declarations (OLD regime only)
    if (regime === 'OLD' && taxDeclarations) {
      const section80C = Math.min(taxDeclarations.section80C || 0, 150000);
      const section80D = Math.min(taxDeclarations.section80D || 0, 50000);
      const section80CCD = Math.min(taxDeclarations.section80CCD || 0, 50000);
      const hraExemption = taxDeclarations.hraExemption || 0;
      annualTaxableIncome = Math.max(0,
        annualTaxableIncome - section80C - section80D - section80CCD - hraExemption
      );
    }

    // Calculate annual tax using regime slabs (DB config or inline defaults)
    const annualTaxResult = regime === 'NEW'
      ? this.calculateNewTaxRegime(annualTaxableIncome, tdsConfig, rebateConfig)
      : this.calculateOldTaxRegime(annualTaxableIncome, tdsConfig);

    // Monthly TDS = annual tax / 12
    let monthlyTDS = annualTaxResult.incomeTax / 12;

    // Adjust for YTD tax already paid (if provided, recalculate remaining monthly TDS)
    if (ytdTaxPaid !== undefined && ytdTaxPaid > 0) {
      const remainingTax = Math.max(0, annualTaxResult.incomeTax - ytdTaxPaid);
      monthlyTDS = remainingTax / 12;
    }

    return {
      taxableIncome: monthlyTaxableIncome,
      incomeTax: Math.round(monthlyTDS),
      regime: annualTaxResult.regime,
      breakdown: annualTaxResult.breakdown,
    };
  }
}
