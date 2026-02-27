import api from './api';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  module?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  id: string;
  role: string;
  permission: Permission;
  organizationId?: string;
  createdAt: string;
}

class PermissionService {
  /**
   * Get all permissions
   */
  async getAll(query?: {
    resource?: string;
    action?: string;
    module?: string;
    page?: string;
    limit?: string;
  }): Promise<{
    permissions: Permission[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await api.get('/permissions', { params: query });
    return response.data.data;
  }

  /**
   * Get permission by ID
   */
  async getById(id: string): Promise<Permission> {
    const response = await api.get(`/permissions/${id}`);
    return response.data.data.permission;
  }

  /**
   * Create new permission
   */
  async create(data: {
    name: string;
    resource: string;
    action: string;
    description?: string;
    module?: string;
  }): Promise<Permission> {
    const response = await api.post('/permissions', data);
    return response.data.data.permission;
  }

  /**
   * Update permission
   */
  async update(id: string, data: {
    name?: string;
    resource?: string;
    action?: string;
    description?: string;
    module?: string;
  }): Promise<Permission> {
    const response = await api.put(`/permissions/${id}`, data);
    return response.data.data.permission;
  }

  /**
   * Delete permission
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/permissions/${id}`);
  }

  /**
   * Get permissions by resource
   */
  async getByResource(resource: string): Promise<Permission[]> {
    const response = await api.get(`/permissions/resource/${resource}`);
    return response.data.data.permissions;
  }

  /**
   * Get permissions by module
   */
  async getByModule(module: string): Promise<Permission[]> {
    const response = await api.get(`/permissions/module/${module}`);
    return response.data.data.permissions;
  }

  /**
   * Get permissions for a role
   */
  async getRolePermissions(
    role: string,
    organizationId?: string
  ): Promise<RolePermission[]> {
    const params = organizationId ? { organizationId } : {};
    const response = await api.get(`/permissions/role-permissions/${role}`, { params });
    return response.data.data.permissions;
  }

  /**
   * Get current user's permissions
   */
  async getUserPermissions(): Promise<Permission[]> {
    const response = await api.get('/permissions/role-permissions/user/permissions');
    return response.data.data.permissions;
  }

  /**
   * Assign permissions to a role
   */
  async assignPermissions(data: {
    role: string;
    permissionIds: string[];
    organizationId?: string;
  }): Promise<{ assigned: number; skipped: number }> {
    const response = await api.post('/permissions/role-permissions/assign', data);
    return response.data.data;
  }

  /**
   * Remove permission from a role
   */
  async removePermission(data: {
    role: string;
    permissionId: string;
    organizationId?: string;
  }): Promise<void> {
    await api.delete('/permissions/role-permissions/remove', { data });
  }

  /**
   * Replace all permissions for a role
   */
  async replaceRolePermissions(
    role: string,
    permissionIds: string[],
    organizationId?: string
  ): Promise<{ removed: number; assigned: number }> {
    const response = await api.put(`/permissions/role-permissions/${role}/replace`, {
      permissionIds,
      organizationId,
    });
    return response.data.data;
  }

  /**
   * Sync app-module permissions (create missing read/create/update). Super Admin only.
   */
  async syncAppModulePermissions(): Promise<{ created: number }> {
    const response = await api.post('/permissions/sync-app-modules');
    return response.data.data;
  }

  /**
   * Check if role has permission
   */
  async checkPermission(data: {
    role: string;
    resource: string;
    action: string;
    organizationId?: string;
  }): Promise<{ hasPermission: boolean }> {
    const response = await api.post('/permissions/role-permissions/check', data);
    return response.data.data;
  }
}

export default new PermissionService();
