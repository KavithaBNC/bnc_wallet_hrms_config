-- Per-organization enabled modules (SAP-style: Super Admin assigns which modules each org gets)
-- Run this if you use raw SQL migrations instead of Prisma migrate.

CREATE TABLE IF NOT EXISTS organization_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    resource VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_organization_modules_organization_id ON organization_modules(organization_id);
