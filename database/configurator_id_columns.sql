-- Configurator ID columns for HRMS ↔ Configurator mapping
-- Run against hrms_db_backup (or hrms_db)
--
-- Table | configurator_id Column | Purpose
-- ------|------------------------|---------
-- organizations | configurator_company_id INT | Links to configurator companies.id
-- users         | configurator_user_id INT   | Links to configurator users.id
-- employees     | configurator_user_id INT   | Links to configurator users.id
-- employees     | department_configurator_id, sub_department_configurator_id, etc. | Reference configurator entities (all INT)

-- Connect to hrms_db_backup if running via psql:
-- \c hrms_db_backup;

-- Organizations: link to Configurator companies.id
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS configurator_company_id INTEGER UNIQUE;

-- Users: link to Configurator users.id
ALTER TABLE users ADD COLUMN IF NOT EXISTS configurator_user_id INTEGER;

-- Employees: link to Configurator users.id
ALTER TABLE employees ADD COLUMN IF NOT EXISTS configurator_user_id INTEGER;

-- Employees: reference configurator entities by ID (all INT in config DB)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_configurator_id INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sub_department_configurator_id INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cost_centre_configurator_id INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS branch_configurator_id INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role_configurator_id INTEGER;

-- Optional: indexes for lookups
CREATE INDEX IF NOT EXISTS idx_organizations_configurator_company_id ON organizations(configurator_company_id);
CREATE INDEX IF NOT EXISTS idx_users_configurator_user_id ON users(configurator_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_configurator_user_id ON employees(configurator_user_id);
