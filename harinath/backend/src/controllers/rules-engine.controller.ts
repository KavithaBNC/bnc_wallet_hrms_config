import { Request, Response } from 'express';
import { rulesEngineService } from '../services/rules-engine.service';

export class RulesEngineController {
  async getRules(req: Request, res: Response) {
    try {
      const organizationId = (req.query.organizationId as string) || (req as unknown as { user?: { organizationId?: string } }).user?.organizationId;
      const paygroupId = req.query.paygroupId as string;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      if (!paygroupId) {
        return res.status(400).json({ message: 'Paygroup ID is required' });
      }
      const rows = await rulesEngineService.getRulesForPaygroup(organizationId, paygroupId);
      return res.json({
        message: 'Rules loaded',
        data: { rules: rows },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load rules';
      return res.status(500).json({ message });
    }
  }

  async saveRules(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId as string;
      const paygroupId = req.body.paygroupId as string;
      const rules = req.body.rules as Array<{
        compoundId: string;
        inputType: string;
        componentBehavior: string;
        formula: string | null;
        percentage: number | null;
        rounding: boolean;
        roundingType: string | null;
        roundOffValue: number | null;
        order: number;
      }>;
      if (!organizationId) {
        return res.status(400).json({ message: 'Organization ID is required' });
      }
      if (!paygroupId) {
        return res.status(400).json({ message: 'Paygroup ID is required' });
      }
      if (!Array.isArray(rules)) {
        return res.status(400).json({ message: 'rules must be an array' });
      }
      const result = await rulesEngineService.saveRules(organizationId, paygroupId, rules);
      return res.json({
        message: 'Rules saved',
        data: result,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save rules';
      const status = (error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : null) ?? 500;
      return res.status(status).json({ message });
    }
  }
}

export const rulesEngineController = new RulesEngineController();
