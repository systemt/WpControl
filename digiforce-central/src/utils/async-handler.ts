import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap async route handlers so thrown errors reach the global error handler
 * instead of being silently swallowed by Express.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
