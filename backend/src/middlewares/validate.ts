import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware to validate request body against a Zod schema
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          status: 'fail',
          message: 'Validation error',
          errors,
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Middleware to validate query parameters
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and transform query params
      const result = schema.parse(req.query);
      // Update req.query with transformed values (for boolean conversions, etc.)
      // This ensures boolean strings like "true" are converted to actual booleans
      Object.keys(result).forEach((key) => {
        req.query[key] = result[key] as any;
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          status: 'fail',
          message: 'Validation error',
          errors,
        });
        return;
      }
      next(error);
    }
  };
};

/**
 * Middleware to validate route parameters
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          status: 'fail',
          message: 'Validation error',
          errors,
        });
        return;
      }
      next(error);
    }
  };
};
