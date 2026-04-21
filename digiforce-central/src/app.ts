import path from 'path';
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { config } from './config';
import { requestLogger } from './middlewares/request-logger';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found';

import authRoutes from './modules/auth/auth.routes';
import adminUsersRoutes from './modules/admin-users/admin-users.routes';
import sitesRoutes from './modules/sites/sites.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import systemRoutes from './modules/system/system.routes';
import agentRoutes from './modules/agent/agent.routes';
import plansRoutes from './modules/plans/plans.routes';
import billingRoutes from './modules/billing/billing.routes';
import adminUIRoutes from './modules/admin-ui/admin-ui.routes';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(helmet());
  app.use(
    cors({
      origin:
        config.CORS_ORIGIN === '*'
          ? true
          : config.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(requestLogger);

  app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

  // Public + authenticated JSON API
  const api = express.Router();
  api.use('/auth', authRoutes);
  api.use('/admin-users', adminUsersRoutes);
  api.use('/sites', sitesRoutes);
  api.use('/dashboard', dashboardRoutes);
  api.use('/system', systemRoutes);
  api.use('/agent', agentRoutes);
  api.use('/plans', plansRoutes);
  api.use('/billing', billingRoutes);
  app.use('/api/v1', api);

  // Server-rendered admin / user console (EJS).
  app.use(adminUIRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
