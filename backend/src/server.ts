import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { config } from './config/config';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security middleware — skip helmet for biometric device routes (eSSL devices choke on CSP/HSTS headers)
app.use((req, res, next) => {
  if (req.path.startsWith('/iclock')) return next();
  return helmet()(req, res, next);
});

// ── Rate Limiting ──────────────────────────────────────────────────────────
// Strict limit for auth routes (login, register, password reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests from this IP, please try again after 15 minutes.' },
  skip: () => config.nodeEnv === 'development',
});

// General API limit — prevents abuse / DoS on all other routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please slow down.' },
  skip: () => config.nodeEnv === 'development',
});

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (config.nodeEnv === 'development') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Parse body as text for biometric device routes BEFORE global JSON/URL-encoded parsers.
// ESSL/ZKTeco devices may send ATTLOG data with Content-Type: text/plain, application/octet-stream,
// or no Content-Type at all. Using `type: () => true` ensures the body is always captured as a string.
app.use('/iclock', express.text({ type: () => true, limit: '1mb' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// HTTP request logger
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'HRMS API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API v1 routes
app.get('/api/v1', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'HRMS API v1',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      organizations: '/api/v1/organizations',
      departments: '/api/v1/departments',
      positions: '/api/v1/positions',
      employees: '/api/v1/employees',
      attendance: '/api/v1/attendance',
      leaves: '/api/v1/leaves',
      payroll: '/api/v1/payroll',
      monthlyAttendanceSummary: '/api/v1/monthly-attendance-summary',
      recruitment: '/api/v1/recruitment',
      chatbot: '/api/v1/chatbot',
      performance: '/api/v1/performance',
      documents: '/api/v1/documents',
      reports: '/api/v1/reports',
      notifications: '/api/v1/notifications',
      postToPayroll: '/api/v1/post-to-payroll',
    },
  });
});

// Import routes
import iclockRoutes from './routes/iclock.routes';
import * as iclockController from './controllers/iclock.controller';
import authRoutes from './routes/auth.routes';
import organizationRoutes from './routes/organization.routes';
import departmentRoutes from './routes/department.routes';
import jobPositionRoutes from './routes/job-position.routes';
import employeeRoutes from './routes/employee.routes';
import employeeChangeRequestRoutes from './routes/employee-change-request.routes';
import leaveRoutes from './routes/leave.routes';
import attendanceRoutes from './routes/attendance.routes';
import faceRoutes from './routes/face.routes';
import holidayRoutes from './routes/holiday.routes';
import shiftRoutes from './routes/shift.routes';
import shiftAssignmentRuleRoutes from './routes/shift-assignment-rule.routes';
import permissionRoutes from './routes/permission.routes';
import payrollRoutes from './routes/payroll.routes';
import employeeSeparationRoutes from './routes/employee-separation.routes';
import fnfSettlementRoutes from './routes/fnf-settlement.routes';
import complianceReportRoutes from './routes/compliance-report.routes';
import statutoryConfigRoutes from './routes/statutory-config.routes';
import loanRoutes from './routes/loan.routes';
import paygroupRoutes from './routes/paygroup.routes';
import locationRoutes from './routes/location.routes';
import entityRoutes from './routes/entity.routes';
import costCentreRoutes from './routes/cost-centre.routes';
import subDepartmentRoutes from './routes/sub-department.routes';
import atsRoutes from './routes/ats.routes';
import transferPromotionRoutes from './routes/transfer-promotion.routes';
import transferPromotionEntryRoutes from './routes/transfer-promotion-entry.routes';
import esopRoutes from './routes/esop.routes';
import attendanceComponentRoutes from './routes/attendance-component.routes';
import encashmentCarryForwardRoutes from './routes/encashment-carry-forward.routes';
import rightsAllocationRoutes from './routes/rights-allocation.routes';
import approvalWorkflowRoutes from './routes/approval-workflow.routes';
import workflowMappingRoutes from './routes/workflow-mapping.routes';
import ruleSettingRoutes from './routes/rule-setting.routes';
import autoCreditSettingRoutes from './routes/auto-credit-setting.routes';
import monthlyAttendanceSummaryRoutes from './routes/monthly-attendance-summary.routes';
import configRoutes from './routes/config.routes';
import compoundRoutes from './routes/compound.routes';
import rulesEngineRoutes from './routes/rules-engine.routes';
import validationProcessRuleRoutes from './routes/validation-process-rule.routes';
import postToPayrollRoutes from './routes/post-to-payroll.routes';

// Mount routes (iclock at root so device can hit /iclock/cdata)
app.use('/iclock', iclockRoutes);

// iClock at root for devices with no path field (device sends to IP:port/ only)
app.get('/', iclockController.getCdata);
app.post('/', express.text({ type: 'text/plain', limit: '1mb' }), iclockController.postCdata);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1', apiLimiter); // Apply general rate limit to all remaining API routes
app.post('/', express.text({ type: () => true, limit: '1mb' }), iclockController.postCdata);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/positions', jobPositionRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/employee-change-requests', employeeChangeRequestRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/face', faceRoutes);
app.use('/api/v1/holidays', holidayRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/shift-assignment-rules', shiftAssignmentRuleRoutes);
app.use('/api/v1/attendance-components', attendanceComponentRoutes);
app.use('/api/v1/encashment-carry-forwards', encashmentCarryForwardRoutes);
app.use('/api/v1/rights-allocations', rightsAllocationRoutes);
app.use('/api/v1/approval-workflows', approvalWorkflowRoutes);
app.use('/api/v1/workflow-mappings', workflowMappingRoutes);
app.use('/api/v1/rule-settings', ruleSettingRoutes);
app.use('/api/v1/auto-credit-settings', autoCreditSettingRoutes);
app.use('/api/v1/monthly-attendance-summary', monthlyAttendanceSummaryRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/compounds', compoundRoutes);
app.use('/api/v1/rules-engine', rulesEngineRoutes);
app.use('/api/v1/validation-process-rules', validationProcessRuleRoutes);
app.use('/api/v1/post-to-payroll', postToPayrollRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/employee-separations', employeeSeparationRoutes);
app.use('/api/v1/fnf-settlements', fnfSettlementRoutes);
app.use('/api/v1/compliance-reports', complianceReportRoutes);
app.use('/api/v1/statutory-config', statutoryConfigRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/paygroups', paygroupRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/entities', entityRoutes);
app.use('/api/v1/cost-centres', costCentreRoutes);
app.use('/api/v1/sub-departments', subDepartmentRoutes);
app.use('/api/v1/ats', atsRoutes);
app.use('/api/v1/transaction/transfer-promotions', transferPromotionRoutes);
app.use('/api/v1/transaction/transfer-promotion-entry', transferPromotionEntryRoutes);
app.use('/api/v1/esop', esopRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 Not Found handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================================================
// SERVER
// ============================================================================

const PORT = config.port || 5000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${config.nodeEnv} mode on port ${PORT}`);
  logger.info(`📍 Base URL: ${config.baseUrl}`);
  logger.info(`🔗 Health check: ${config.baseUrl}/health`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`\n❌ Port ${PORT} is already in use!`);
    logger.error(`\n💡 To fix this, run one of these commands:`);
    logger.error(`   1. Find and kill the process:`);
    logger.error(`      netstat -ano | findstr :${PORT}`);
    logger.error(`      taskkill /PID <PID> /F`);
    logger.error(`\n   2. Or change the port in .env file:`);
    logger.error(`      PORT=5001`);
    logger.error(`\n   3. Or run: npm run kill-port`);
    process.exit(1);
  } else {
    logger.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);

  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await prisma.$disconnect();
      logger.info('Prisma client disconnected');
    } catch (error) {
      logger.error('Error while disconnecting Prisma client', error);
    } finally {
      process.exit(0);
    }
  });
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

export default app;
