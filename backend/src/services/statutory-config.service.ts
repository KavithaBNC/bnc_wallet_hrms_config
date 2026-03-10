import { prisma } from '../utils/prisma';

// ============================================================================
// Config Interfaces
// ============================================================================

export interface PfConfig {
  wageCeiling: number;
  employeeRate: number;
  employerEpsRate: number;
  employerEpfRate: number;
  edliRate: number;
  adminChargeRate: number;
}

export interface EsiConfig {
  grossThreshold: number;
  employeeRate: number;
  employerRate: number;
}

export interface PtSlabEntry {
  maxSalary: number | null; // null = Infinity
  tax: number;
}

export interface PtSlabConfig {
  slabs: PtSlabEntry[];
  defaultTax: number;
  specialMonths?: Record<string, number>; // e.g. { "2": 300 } for Maharashtra Feb
}

export interface TdsSlabEntry {
  min: number;
  max: number | null; // null = Infinity
  rate: number;
}

export interface TdsSlabConfig {
  slabs: TdsSlabEntry[];
  cessRate: number;
}

export interface StandardDeductionConfig {
  NEW: number;
  OLD: number;
}

export interface RebateConfig {
  maxRebate: number;
  incomeLimit: number;
}

export interface FullStatutoryConfig {
  pf: PfConfig;
  esi: EsiConfig;
  pt: Record<string, PtSlabConfig>; // keyed by state (e.g. "TAMIL_NADU")
  tdsNew: TdsSlabConfig;
  tdsOld: TdsSlabConfig;
  standardDeduction: StandardDeductionConfig;
  rebate: RebateConfig;
}

// ============================================================================
// Hardcoded Defaults (fallback when DB has no config)
// ============================================================================

const DEFAULT_PF: PfConfig = {
  wageCeiling: 15000,
  employeeRate: 12,
  employerEpsRate: 8.33,
  employerEpfRate: 3.67,
  edliRate: 0.5,
  adminChargeRate: 0.5,
};

const DEFAULT_ESI: EsiConfig = {
  grossThreshold: 21000,
  employeeRate: 0.75,
  employerRate: 3.25,
};

/**
 * City / town / district → canonical state key mapping.
 * Normalizes what HR enters in ptaxLocation (e.g. "Chennai", "chennai", "CHENNAI")
 * to the state key used in PT slabs (e.g. "TAMIL_NADU").
 */
export const CITY_TO_STATE_MAP: Record<string, string> = {
  // Tamil Nadu
  CHENNAI: 'TAMIL_NADU',
  COIMBATORE: 'TAMIL_NADU',
  MADURAI: 'TAMIL_NADU',
  TRICHY: 'TAMIL_NADU',
  TIRUCHIRAPPALLI: 'TAMIL_NADU',
  TIRUNELVELI: 'TAMIL_NADU',
  SALEM: 'TAMIL_NADU',
  ERODE: 'TAMIL_NADU',
  TIRUPPUR: 'TAMIL_NADU',
  VELLORE: 'TAMIL_NADU',
  THOOTHUKUDI: 'TAMIL_NADU',
  TUTICORIN: 'TAMIL_NADU',
  THANJAVUR: 'TAMIL_NADU',
  DINDIGUL: 'TAMIL_NADU',
  TAMBARAM: 'TAMIL_NADU',
  AVADI: 'TAMIL_NADU',
  HOSUR: 'TAMIL_NADU',

  // Maharashtra
  MUMBAI: 'MAHARASHTRA',
  PUNE: 'MAHARASHTRA',
  NAGPUR: 'MAHARASHTRA',
  NASHIK: 'MAHARASHTRA',
  AURANGABAD: 'MAHARASHTRA',
  THANE: 'MAHARASHTRA',
  SOLAPUR: 'MAHARASHTRA',
  NAVI_MUMBAI: 'MAHARASHTRA',
  NAVI: 'MAHARASHTRA',
  KOLHAPUR: 'MAHARASHTRA',
  AMRAVATI: 'MAHARASHTRA',
  PIMPRI: 'MAHARASHTRA',
  KALYAN: 'MAHARASHTRA',
  VASAI: 'MAHARASHTRA',

  // Karnataka
  BANGALORE: 'KARNATAKA',
  BENGALURU: 'KARNATAKA',
  MYSORE: 'KARNATAKA',
  MYSURU: 'KARNATAKA',
  HUBLI: 'KARNATAKA',
  DHARWAD: 'KARNATAKA',
  MANGALORE: 'KARNATAKA',
  MANGALURU: 'KARNATAKA',
  BELGAUM: 'KARNATAKA',
  BELAGAVI: 'KARNATAKA',
  GULBARGA: 'KARNATAKA',
  KALABURAGI: 'KARNATAKA',
  DAVANAGERE: 'KARNATAKA',

  // Telangana
  HYDERABAD: 'TELANGANA',
  WARANGAL: 'TELANGANA',
  NIZAMABAD: 'TELANGANA',
  KARIMNAGAR: 'TELANGANA',
  SECUNDERABAD: 'TELANGANA',

  // Andhra Pradesh
  VISAKHAPATNAM: 'ANDHRA_PRADESH',
  VIZAG: 'ANDHRA_PRADESH',
  VIJAYAWADA: 'ANDHRA_PRADESH',
  GUNTUR: 'ANDHRA_PRADESH',
  NELLORE: 'ANDHRA_PRADESH',
  TIRUPATI: 'ANDHRA_PRADESH',
  KURNOOL: 'ANDHRA_PRADESH',
  KAKINADA: 'ANDHRA_PRADESH',
  RAJAHMUNDRY: 'ANDHRA_PRADESH',

  // West Bengal
  KOLKATA: 'WEST_BENGAL',
  CALCUTTA: 'WEST_BENGAL',
  HOWRAH: 'WEST_BENGAL',
  DURGAPUR: 'WEST_BENGAL',
  ASANSOL: 'WEST_BENGAL',
  SILIGURI: 'WEST_BENGAL',
  BARDHAMAN: 'WEST_BENGAL',
  BURDWAN: 'WEST_BENGAL',

  // Gujarat
  AHMEDABAD: 'GUJARAT',
  SURAT: 'GUJARAT',
  VADODARA: 'GUJARAT',
  BARODA: 'GUJARAT',
  RAJKOT: 'GUJARAT',
  BHAVNAGAR: 'GUJARAT',
  JAMNAGAR: 'GUJARAT',
  GANDHINAGAR: 'GUJARAT',
  ANAND: 'GUJARAT',
};

/**
 * Resolve a raw ptaxLocation value (city, district, or state key) to the canonical
 * state key used in PT slab configs. Returns undefined if no match found.
 */
export function resolvePtaxStateKey(rawLocation: string): string | undefined {
  if (!rawLocation) return undefined;
  // Normalize: uppercase + trim + collapse spaces to underscore
  const normalized = rawLocation.trim().toUpperCase().replace(/\s+/g, '_');
  // Direct state key match (e.g. "TAMIL_NADU" already correct)
  if (normalized in DEFAULT_PT_SLABS) return normalized;
  // City → state lookup
  return CITY_TO_STATE_MAP[normalized];
}

const DEFAULT_PT_SLABS: Record<string, PtSlabConfig> = {
  TAMIL_NADU: {
    slabs: [
      { maxSalary: 21000, tax: 0 },
      { maxSalary: 30000, tax: 100 },
      { maxSalary: 45000, tax: 135 },
      { maxSalary: 60000, tax: 315 },
      { maxSalary: 75000, tax: 690 },
      { maxSalary: null, tax: 1025 },
    ],
    defaultTax: 200,
  },
  MAHARASHTRA: {
    slabs: [
      { maxSalary: 7500, tax: 0 },
      { maxSalary: 10000, tax: 175 },
      { maxSalary: null, tax: 200 },
    ],
    defaultTax: 200,
    specialMonths: { '2': 300 },
  },
  KARNATAKA: {
    slabs: [
      { maxSalary: 15000, tax: 0 },
      { maxSalary: 25000, tax: 200 },
      { maxSalary: 50000, tax: 300 },
      { maxSalary: null, tax: 500 },
    ],
    defaultTax: 200,
  },
  TELANGANA: {
    slabs: [
      { maxSalary: 15000, tax: 0 },
      { maxSalary: 20000, tax: 150 },
      { maxSalary: null, tax: 200 },
    ],
    defaultTax: 200,
  },
  ANDHRA_PRADESH: {
    slabs: [
      { maxSalary: 15000, tax: 0 },
      { maxSalary: 20000, tax: 150 },
      { maxSalary: null, tax: 200 },
    ],
    defaultTax: 200,
  },
  WEST_BENGAL: {
    slabs: [
      { maxSalary: 10000, tax: 0 },
      { maxSalary: 15000, tax: 110 },
      { maxSalary: 25000, tax: 130 },
      { maxSalary: 40000, tax: 150 },
      { maxSalary: null, tax: 200 },
    ],
    defaultTax: 200,
  },
  GUJARAT: {
    slabs: [
      { maxSalary: 5999, tax: 0 },
      { maxSalary: 8999, tax: 80 },
      { maxSalary: 11999, tax: 150 },
      { maxSalary: null, tax: 200 },
    ],
    defaultTax: 200,
  },
};

const DEFAULT_TDS_NEW: TdsSlabConfig = {
  slabs: [
    { min: 0, max: 400000, rate: 0 },
    { min: 400000, max: 800000, rate: 5 },
    { min: 800000, max: 1200000, rate: 10 },
    { min: 1200000, max: 1600000, rate: 15 },
    { min: 1600000, max: 2000000, rate: 20 },
    { min: 2000000, max: 2400000, rate: 25 },
    { min: 2400000, max: null, rate: 30 },
  ],
  cessRate: 4,
};

const DEFAULT_TDS_OLD: TdsSlabConfig = {
  slabs: [
    { min: 0, max: 250000, rate: 0 },
    { min: 250000, max: 500000, rate: 5 },
    { min: 500000, max: 1000000, rate: 20 },
    { min: 1000000, max: null, rate: 30 },
  ],
  cessRate: 4,
};

const DEFAULT_STANDARD_DEDUCTION: StandardDeductionConfig = {
  NEW: 75000,
  OLD: 50000,
};

const DEFAULT_REBATE: RebateConfig = {
  maxRebate: 60000,
  incomeLimit: 1200000,
};

// ============================================================================
// Service
// ============================================================================

export class StatutoryConfigService {
  private cache: Map<string, FullStatutoryConfig> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the current financial year string (e.g. "2025-26")
   */
  static getFinancialYear(year: number, month: number): string {
    const fyStart = month >= 4 ? year : year - 1;
    return `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
  }

  /**
   * Get the current FY based on today's date
   */
  static getCurrentFinancialYear(): string {
    const now = new Date();
    return StatutoryConfigService.getFinancialYear(now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Load all statutory configs for a financial year.
   * Returns a FullStatutoryConfig with DB values merged over defaults.
   */
  async getFullConfig(financialYear?: string): Promise<FullStatutoryConfig> {
    const fy = financialYear || StatutoryConfigService.getCurrentFinancialYear();

    // Check cache
    const cached = this.cache.get(fy);
    const ts = this.cacheTimestamps.get(fy) || 0;
    if (cached && Date.now() - ts < this.CACHE_TTL_MS) {
      return cached;
    }

    // Fetch all active configs for this FY from DB
    const rows = await prisma.statutoryRateConfig.findMany({
      where: {
        financialYear: fy,
        isActive: true,
      },
    });

    // Build config from DB rows, falling back to defaults
    const config = this.buildConfig(rows);

    // Cache it
    this.cache.set(fy, config);
    this.cacheTimestamps.set(fy, Date.now());

    return config;
  }

  /**
   * Build FullStatutoryConfig from DB rows, with fallback to hardcoded defaults
   */
  private buildConfig(rows: Array<{ configType: string; region: string | null; rules: any }>): FullStatutoryConfig {
    let pf = DEFAULT_PF;
    let esi = DEFAULT_ESI;
    const pt: Record<string, PtSlabConfig> = { ...DEFAULT_PT_SLABS };
    let tdsNew = DEFAULT_TDS_NEW;
    let tdsOld = DEFAULT_TDS_OLD;
    let standardDeduction = DEFAULT_STANDARD_DEDUCTION;
    let rebate = DEFAULT_REBATE;

    for (const row of rows) {
      const rules = row.rules as any;
      switch (row.configType) {
        case 'PF':
          pf = {
            wageCeiling: rules.wageCeiling ?? DEFAULT_PF.wageCeiling,
            employeeRate: rules.employeeRate ?? DEFAULT_PF.employeeRate,
            employerEpsRate: rules.employerEpsRate ?? DEFAULT_PF.employerEpsRate,
            employerEpfRate: rules.employerEpfRate ?? DEFAULT_PF.employerEpfRate,
            edliRate: rules.edliRate ?? DEFAULT_PF.edliRate,
            adminChargeRate: rules.adminChargeRate ?? DEFAULT_PF.adminChargeRate,
          };
          break;

        case 'ESI':
          esi = {
            grossThreshold: rules.grossThreshold ?? DEFAULT_ESI.grossThreshold,
            employeeRate: rules.employeeRate ?? DEFAULT_ESI.employeeRate,
            employerRate: rules.employerRate ?? DEFAULT_ESI.employerRate,
          };
          break;

        case 'PT':
          if (row.region) {
            const stateKey = row.region.toUpperCase().replace(/\s+/g, '_');
            pt[stateKey] = {
              slabs: (rules.slabs || []).map((s: any) => ({
                maxSalary: s.maxSalary, // null = Infinity
                tax: s.tax,
              })),
              defaultTax: rules.defaultTax ?? 200,
              specialMonths: rules.specialMonths,
            };
          }
          break;

        case 'TDS_NEW_REGIME':
          tdsNew = {
            slabs: (rules.slabs || []).map((s: any) => ({
              min: s.min,
              max: s.max, // null = Infinity
              rate: s.rate,
            })),
            cessRate: rules.cessRate ?? 4,
          };
          break;

        case 'TDS_OLD_REGIME':
          tdsOld = {
            slabs: (rules.slabs || []).map((s: any) => ({
              min: s.min,
              max: s.max,
              rate: s.rate,
            })),
            cessRate: rules.cessRate ?? 4,
          };
          break;

        case 'STANDARD_DEDUCTION':
          standardDeduction = {
            NEW: rules.NEW ?? DEFAULT_STANDARD_DEDUCTION.NEW,
            OLD: rules.OLD ?? DEFAULT_STANDARD_DEDUCTION.OLD,
          };
          break;

        case 'REBATE_87A':
          rebate = {
            maxRebate: rules.maxRebate ?? DEFAULT_REBATE.maxRebate,
            incomeLimit: rules.incomeLimit ?? DEFAULT_REBATE.incomeLimit,
          };
          break;
      }
    }

    return { pf, esi, pt, tdsNew, tdsOld, standardDeduction, rebate };
  }

  // Convenience getters

  async getPfConfig(fy?: string): Promise<PfConfig> {
    return (await this.getFullConfig(fy)).pf;
  }

  async getEsiConfig(fy?: string): Promise<EsiConfig> {
    return (await this.getFullConfig(fy)).esi;
  }

  async getPtConfig(state: string, fy?: string): Promise<PtSlabConfig | undefined> {
    const config = await this.getFullConfig(fy);
    // Resolve city / district names to canonical state keys (e.g. "Chennai" → "TAMIL_NADU")
    const key = resolvePtaxStateKey(state) || state.toUpperCase().replace(/\s+/g, '_');
    return config.pt[key];
  }

  async getTdsSlabs(regime: 'NEW' | 'OLD', fy?: string): Promise<TdsSlabConfig> {
    const config = await this.getFullConfig(fy);
    return regime === 'NEW' ? config.tdsNew : config.tdsOld;
  }

  async getStandardDeduction(fy?: string): Promise<StandardDeductionConfig> {
    return (await this.getFullConfig(fy)).standardDeduction;
  }

  async getRebateConfig(fy?: string): Promise<RebateConfig> {
    return (await this.getFullConfig(fy)).rebate;
  }

  /**
   * Invalidate cache (call after config updates)
   */
  invalidateCache(fy?: string): void {
    if (fy) {
      this.cache.delete(fy);
      this.cacheTimestamps.delete(fy);
    } else {
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }
}

export const statutoryConfigService = new StatutoryConfigService();
