import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  nodeEnv: string;
  port: number;
  baseUrl: string;
  corsOrigin: string;
  databaseUrl: string;
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
  configuratorHrmsProjectId: number;
  configuratorDefaultCompanyId: number;
  configuratorDefaultRole: string;
  configuratorPlaceholderPasswordHash: string;
}

export const config: AppConfig = {
  // Server (default 5001 to match root "npm run dev" and frontend proxy)
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5001', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:5001',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/hrms_db_backup',

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

  // Configurator API - Login: http://bnc-ai.com:8001/api/v1/auth/login
  configuratorApiUrl: 'http://bnc-ai.com:8001',
  configuratorHrmsProjectId: 5,
  configuratorDefaultCompanyId: parseInt(process.env.CONFIGURATOR_DEFAULT_COMPANY_ID || '59', 10),
  configuratorDefaultRole: process.env.CONFIGURATOR_DEFAULT_ROLE || 'ORG_ADMIN',
  configuratorPlaceholderPasswordHash:
    process.env.CONFIGURATOR_PLACEHOLDER_PASSWORD_HASH ||
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
};
