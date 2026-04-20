import { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'not_found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
};
