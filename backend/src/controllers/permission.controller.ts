import { Request, Response, NextFunction } from 'express';
import { permissionService } from '../services/permission.service';

export class PermissionController {
  /**
   * Create new permission
   * POST /api/v1/permissions
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const permission = await permissionService.create(req.body);

      res.status(201).json({
        status: 'success',
        message: 'Permission created successfully',
        data: { permission },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get all permissions
   * GET /api/v1/permissions
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await permissionService.getAll(req.query as any);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get permission by ID
   * GET /api/v1/permissions/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const permission = await permissionService.getById(id);

      res.status(200).json({
        status: 'success',
        data: { permission },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update permission
   * PUT /api/v1/permissions/:id
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const permission = await permissionService.update(id, req.body);

      res.status(200).json({
        status: 'success',
        message: 'Permission updated successfully',
        data: { permission },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete permission
   * DELETE /api/v1/permissions/:id
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await permissionService.delete(id);

      res.status(200).json({
        status: 'success',
        message: 'Permission deleted successfully',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Sync app-module permissions (create missing read/create/update for all app modules).
   * POST /api/v1/permissions/sync-app-modules
   */
  async syncAppModulePermissions(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await permissionService.syncAppModulePermissions();

      res.status(200).json({
        status: 'success',
        message:
          result.created > 0
            ? `Created ${result.created} missing permission(s). Refresh the page to see all checkboxes.`
            : 'All app-module permissions already exist.',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get permissions by resource
   * GET /api/v1/permissions/resource/:resource
   */
  async getByResource(req: Request, res: Response, next: NextFunction) {
    try {
      const { resource } = req.params;
      const permissions = await permissionService.getByResource(resource);

      res.status(200).json({
        status: 'success',
        data: { permissions },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get permissions by module
   * GET /api/v1/permissions/module/:module
   */
  async getByModule(req: Request, res: Response, next: NextFunction) {
    try {
      const { module } = req.params;
      const permissions = await permissionService.getByModule(module);

      res.status(200).json({
        status: 'success',
        data: { permissions },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const permissionController = new PermissionController();
