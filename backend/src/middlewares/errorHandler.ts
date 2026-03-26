import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface ApiError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  status: string;
  isOperational: boolean;
  validationErrors?: string[];

  constructor(message: string, statusCode: number, validationErrors?: string[]) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    if (validationErrors) this.validationErrors = validationErrors;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const prismaErr = err as ApiError & { code?: string };
  const prismaCode = prismaErr.code;
  const errMessage = String(err.message || '').toLowerCase();
  const isDbConnectivityError =
    prismaCode === 'P1001' ||   // Can't reach database server
    prismaCode === 'P1017' ||   // Server has closed the connection
    prismaCode === 'P2024' ||   // Timed out fetching a new connection from the pool
    prismaCode === 'P1008' ||   // Operations timed out
    errMessage.includes('connection pool') ||
    errMessage.includes("can't reach database server") ||
    errMessage.includes('server has closed the connection') ||
    errMessage.includes('connection reset') ||
    errMessage.includes('connectionreset') ||
    errMessage.includes('econnreset') ||
    errMessage.includes('econnrefused') ||
    errMessage.includes('socket hang up') ||
    errMessage.includes('timed out') ||
    errMessage.includes('pool timeout') ||
    errMessage.includes('connect timeout');

  if (isDbConnectivityError) {
    err = new AppError('Database temporarily unavailable. Please try again.', 503);
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log: 4xx client errors (e.g. 401 Unauthorized) as warn to avoid noise; 5xx as error with stack
  const is4xx = err.statusCode >= 400 && err.statusCode < 500;
  if (is4xx) {
    logger.warn({
      message: err.message,
      statusCode: err.statusCode,
      url: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.error({
      message: err.message,
      statusCode: err.statusCode,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Development error response
  if (config.nodeEnv === 'development') {
    const response: Record<string, unknown> = {
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    };
    if ((err as AppError).validationErrors) {
      response.validationErrors = (err as AppError).validationErrors;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  // Production error response
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    // Reduce log noise for 4xx errors (client errors like 400, 401, 403, 404)
    if (err.statusCode >= 400 && err.statusCode < 500) {
      logger.warn(`${err.status.toUpperCase()} ${err.statusCode}: ${err.message}`);
    } else {
      logger.error('ERROR 💥', err);
    }

    const response: Record<string, unknown> = {
      status: err.status,
      message: err.message,
    };
    if ((err as AppError).validationErrors) {
      response.validationErrors = (err as AppError).validationErrors;
    }
    res.status(err.statusCode).json(response);
  } else {
    // Programming or unknown error: don't leak error details
    logger.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};
