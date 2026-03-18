import api from './api';

export interface RulesEngineRow {
  ruleId: string | null;
  compoundId: string;
  shortName: string;
  longName: string;
  category: string;
  inputType: string;
  componentBehavior: string;
  formula: string | null;
  percentage: number | null;
  rounding: boolean;
  roundingType: string | null;
  roundOffValue: number | null;
  order: number;
}

export interface SaveRuleItem {
  compoundId: string;
  inputType: string;
  componentBehavior: string;
  formula: string | null;
  percentage: number | null;
  rounding: boolean;
  roundingType: string | null;
  roundOffValue: number | null;
  order: number;
}

export interface GetRulesParams {
  organizationId: string;
  paygroupId: string;
}

export interface SaveRulesParams {
  organizationId: string;
  paygroupId: string;
  rules: SaveRuleItem[];
}

export default {
  async getRules(params: GetRulesParams): Promise<RulesEngineRow[]> {
    const { data } = await api.get<{ data: { rules: RulesEngineRow[] } }>('/rules-engine', {
      params: { organizationId: params.organizationId, paygroupId: params.paygroupId },
    });
    return data.data?.rules ?? [];
  },

  async saveRules(params: SaveRulesParams): Promise<{ saved: number }> {
    const { data } = await api.put<{ data: { saved: number } }>('/rules-engine', {
      organizationId: params.organizationId,
      paygroupId: params.paygroupId,
      rules: params.rules,
    });
    return data.data ?? { saved: 0 };
  },
};
