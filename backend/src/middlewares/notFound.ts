import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found on this server`,
    404
  );
  next(error);
};
