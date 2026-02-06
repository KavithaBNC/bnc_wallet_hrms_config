import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { config } from './config/config';
import { logger } from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security middleware
app.use(helmet());

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
      recruitment: '/api/v1/recruitment',
      chatbot: '/api/v1/chatbot',
      performance: '/api/v1/performance',
      documents: '/api/v1/documents',
      reports: '/api/v1/reports',
      notifications: '/api/v1/notifications',
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
import paygroupRoutes from './routes/paygroup.routes';
import locationRoutes from './routes/location.routes';
import entityRoutes from './routes/entity.routes';
import costCentreRoutes from './routes/cost-centre.routes';
import subDepartmentRoutes from './routes/sub-department.routes';
import atsRoutes from './routes/ats.routes';
import transferPromotionRoutes from './routes/transfer-promotion.routes';
import transferPromotionEntryRoutes from './routes/transfer-promotion-entry.routes';
import esopRoutes from './routes/esop.routes';

// Mount routes (iclock at root so device can hit /iclock/cdata)
app.use('/iclock', iclockRoutes);

// iClock at root for devices with no path field (device sends to IP:port/ only)
app.get('/', iclockController.getCdata);
app.post('/', express.text({ type: 'text/plain', limit: '1mb' }), iclockController.postCdata);
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
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/employee-separations', employeeSeparationRoutes);
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
    logger.error(`\n   3. Or use PowerShell:`);
    logger.error(`      Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }`);
    process.exit(1);
  } else {
    logger.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;
