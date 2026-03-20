-- HRMS Database Initialization Script
-- This script runs when the PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: pgvector extension needs to be installed manually
-- For AI features, install pgvector: CREATE EXTENSION IF NOT EXISTS vector;

-- Create database (if not exists via environment variable)
-- The database 'hrms_live' is created automatically by the POSTGRES_DB env variable

\c hrms_live;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE hrms_live TO postgres;

-- Create initial schema will be handled by Prisma migrations
-- This file is for any additional custom setup

SELECT 'HRMS Database initialized successfully!' AS message;
