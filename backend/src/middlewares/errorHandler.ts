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

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
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
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
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

    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or unknown error: don't leak error details
    logger.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};
