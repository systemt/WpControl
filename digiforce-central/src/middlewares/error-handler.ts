import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error';
import { config } from '../config';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'validation_error',
        message: 'Invalid request payload',
        details: err.flatten(),
      },
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'internal_error',
      message:
        config.NODE_ENV === 'production'
          ? 'Internal server error'
          : err instanceof Error
          ? err.message
          : 'Internal server error',
    },
  });
};
