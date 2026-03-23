import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPLOYEE_MODULES, type EmployeeModuleId } from '../constants/employeeModules';
import { getModulePermissions } from '../config/configurator-module-mapping';

export interface ModulePermission {
  id: EmployeeModuleId;
  name: string;
  expandable?: boolean;
  viewable: boolean;
  editable: boolean;
  mandatory: boolean;
  approval: boolean;
}

export interface HRAuditSettings {
  role: string;
  allowDelete: boolean;
  addApproval: boolean;
  modules: ModulePermission[];
}

/** Default: all viewable, all editable, no approval (full permission) */
const getDefaultModulesFull = (): ModulePermission[] =>
  EMPLOYEE_MODULES.map((m) => ({
    ...m,
    viewable: true,
    editable: true,
    mandatory: false,
    approval: false,
  }));

/** Default for standard roles: some editable (incl. personal so employees can edit own Personal Info), approval on */
const getDefaultModulesRestricted = (): ModulePermission[] =>
  EMPLOYEE_MODULES.map((m) => ({
    ...m,
    viewable: true,
    editable: ['company', 'personal', 'bank', 'assets', 'academic', 'previousEmployment', 'family', 'others', 'newFields'].includes(m.id),
    mandatory: false,
    approval: true,
  }));

/** Dynamic: check Config API permissions to determine default modules for a role */
const getDefaultModulesForRole = (_role: string): ModulePermission[] => {
  const empPerms = getModulePermissions('/employees');
  return empPerms.can_edit ? getDefaultModulesFull() : getDefaultModulesRestricted();
};

/** Dynamic: check Config API permissions to determine allowDelete default */
const getDefaultAllowDelete = (_role: string): boolean => {
  return getModulePermissions('/employees').can_delete;
};

/** Normalize role to uppercase so HR Audit Settings (EMPLOYEE) matches auth user (Employee/EMPLOYEE) */
const toRoleKey = (role: string) => (role || 'USER').toUpperCase();

type RoleKey = string;

interface HRAuditStore {
  /** Settings per role (key = role e.g. USER, HR_MANAGER) */
  byRole: Record<RoleKey, HRAuditSettings>;
  getSettingsForRole: (role: string) => HRAuditSettings;
  setSettingsForRole: (role: string, settings: Partial<HRAuditSettings>) => void;
  updateModule: (role: string, moduleId: EmployeeModuleId, field: keyof ModulePermission, value: boolean) => void;
  resetRole: (role: string) => void;
}

export const useHRAuditStore = create<HRAuditStore>()(
  persist(
    (set, get) => ({
      byRole: {},

      getSettingsForRole(role: string) {
        const state = get();
        const key = toRoleKey(role);
        const existing = state.byRole[key];
        if (existing) return existing;
        return {
          role: key,
          allowDelete: getDefaultAllowDelete(key),
          addApproval: false,
          modules: getDefaultModulesForRole(key),
        };
      },

      setSettingsForRole(role: string, settings: Partial<HRAuditSettings>) {
        const key = toRoleKey(role);
        set((s) => ({
          byRole: {
            ...s.byRole,
            [key]: {
              ...s.getSettingsForRole(role),
              ...settings,
            },
          },
        }));
      },

      updateModule(role: string, moduleId: EmployeeModuleId, field: keyof ModulePermission, value: boolean) {
        const key = toRoleKey(role);
        set((s) => {
          const current = s.getSettingsForRole(role);
          const modules = current.modules.map((m) =>
            m.id === moduleId ? { ...m, [field]: value } : m
          );
          return {
            byRole: {
              ...s.byRole,
              [key]: { ...current, modules },
            },
          };
        });
      },

      resetRole(role: string) {
        const key = toRoleKey(role);
        set((s) => ({
          byRole: {
            ...s.byRole,
            [key]: {
              role: key,
              allowDelete: getDefaultAllowDelete(key),
              addApproval: false,
              modules: getDefaultModulesForRole(key),
            },
          },
        }));
      },
    }),
    { name: 'hr-audit-settings', partialize: (s) => ({ byRole: s.byRole }) }
  )
);
