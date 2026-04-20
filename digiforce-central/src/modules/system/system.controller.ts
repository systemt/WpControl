import { RequestHandler } from 'express';
import { config } from '../../config';

export const getHealth: RequestHandler = (_req, res) => {
  res.json({
    success: true,
    data: {
      app: config.APP_NAME,
      version: config.APP_VERSION,
      environment: config.NODE_ENV,
      server_time: new Date().toISOString(),
    },
  });
};
