import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { statutoryConfigService } from '../services/statutory-config.service';

export class StatutoryConfigController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { configType, financialYear } = req.query;
      const where: any = { isActive: true };
      if (configType) where.configType = configType;
      if (financialYear) where.financialYear = financialYear;

      const configs = await prisma.statutoryRateConfig.findMany({
        where,
        orderBy: [{ configType: 'asc' }, { region: 'asc' }, { financialYear: 'desc' }],
      });
      return res.status(200).json({ status: 'success', data: configs });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { rules, name, effectiveFrom, effectiveTo, isActive } = req.body;

      const existing = await prisma.statutoryRateConfig.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ status: 'fail', message: 'Statutory rate config not found' });
      }

      const updated = await prisma.statutoryRateConfig.update({
        where: { id },
        data: {
          ...(rules !== undefined && { rules }),
          ...(name && { name }),
          ...(effectiveFrom && { effectiveFrom: new Date(effectiveFrom) }),
          ...(effectiveTo && { effectiveTo: new Date(effectiveTo) }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      // Invalidate cache so next payroll run picks up new rates
      statutoryConfigService.invalidateCache();

      return res.status(200).json({ status: 'success', data: updated });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { configType, country, region, financialYear, name, rules, effectiveFrom, effectiveTo } = req.body;
      if (!configType || !financialYear || !name || !rules || !effectiveFrom || !effectiveTo) {
        return res.status(400).json({ status: 'fail', message: 'configType, financialYear, name, rules, effectiveFrom, effectiveTo are required' });
      }

      const config = await prisma.statutoryRateConfig.create({
        data: {
          configType,
          country: country || 'IN',
          region: region || null,
          financialYear,
          name,
          rules,
          effectiveFrom: new Date(effectiveFrom),
          effectiveTo: new Date(effectiveTo),
          isActive: true,
        },
      });

      statutoryConfigService.invalidateCache();
      return res.status(201).json({ status: 'success', data: config });
    } catch (error) {
      return next(error);
    }
  }
}

export const statutoryConfigController = new StatutoryConfigController();
