import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  nodeEnv: string;
  port: number;
  baseUrl: string;
  corsOrigin: string;
  databaseUrl: string;
  configDatabaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtAccessExpiration: string;
  jwtRefreshExpiration: string;
  emailFrom: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  maxFileSize: number;
  uploadDir: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsS3Bucket: string;
  openaiApiKey: string;
  openaiModel: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  defaultPageSize: number;
  maxPageSize: number;
  frontendUrl: string;
  configuratorApiUrl: string;
  configuratorApiFallbackUrl: string;
  configuratorHrmsProjectId: number;
  configuratorDefaultCompanyId: number;
  /** Module code → path mapping. Load from MODULE_CODE_TO_PATH JSON env. Config DB path preferred when available. */
  configuratorModulePathMapping: Record<string, string>;
  configuratorRoleIds: Record<string, number>;
  configuratorPlaceholderPasswordHash: string;
}

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 0,
  baseUrl:
    process.env.BASE_URL ||
    (process.env.PORT ? `http://localhost:${process.env.PORT}` : ''),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/hrms_live',
  configDatabaseUrl: process.env.CONFIG_DATABASE_URL || '',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',

  // Email
  emailFrom: process.env.EMAIL_FROM || 'noreply@hrms.com',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
  uploadDir: process.env.UPLOAD_DIR || './uploads',

  // AWS S3 (or MinIO)
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  awsS3Bucket: process.env.AWS_S3_BUCKET || '',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Pagination
  defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
  maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),

  // Frontend URL (for email links, etc.)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Configurator API - single source: CONFIGURATOR_API_URL or RAG_API_URL (legacy)
  configuratorApiUrl:
    process.env.CONFIGURATOR_API_URL ||
    process.env.RAG_API_URL ||
    'http://bnc-ai.com:8001',
  // Fallback URL when primary is unreachable (e.g. LAN IP from outside office)
  configuratorApiFallbackUrl: process.env.CONFIGURATOR_API_FALLBACK_URL || '',
  configuratorHrmsProjectId: process.env.CONFIGURATOR_HRMS_PROJECT_ID ? parseInt(process.env.CONFIGURATOR_HRMS_PROJECT_ID, 10) : 0,
  configuratorDefaultCompanyId: process.env.CONFIGURATOR_DEFAULT_COMPANY_ID ? parseInt(process.env.CONFIGURATOR_DEFAULT_COMPANY_ID, 10) : 0,
  /** Module code → path fallback. Optional when Config DB project_modules.page_name is populated. */
  configuratorModulePathMapping: (() => {
    try {
      const raw = process.env.MODULE_CODE_TO_PATH;
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  })(),
  configuratorRoleIds: (() => {
    try {
      const raw = process.env.CONFIGURATOR_ROLE_IDS;
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  })(),
  configuratorPlaceholderPasswordHash:
    process.env.CONFIGURATOR_PLACEHOLDER_PASSWORD_HASH ||
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
};
