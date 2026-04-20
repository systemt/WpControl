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
import adminUIRoutes from './modules/admin-ui/admin-ui.routes';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // EJS view engine — views live next to the compiled code so the same
  // relative path works in dev (src/views) and prod (dist/views after copy).
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

  // Cookie parser for the admin UI session cookie.
  app.use(cookieParser());

  // URL-encoded body parser for the login form.
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // JSON parser + raw-body capture for the agent HMAC middleware.
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );

  app.use(requestLogger);

  // Static admin assets — CSS, future icons, etc.
  app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

  // REST API (unchanged)
  const api = express.Router();
  api.use('/auth', authRoutes);
  api.use('/admin-users', adminUsersRoutes);
  api.use('/sites', sitesRoutes);
  api.use('/dashboard', dashboardRoutes);
  api.use('/system', systemRoutes);
  api.use('/agent', agentRoutes);
  app.use('/api/v1', api);

  // Server-rendered admin UI (login + /admin/*).
  app.use(adminUIRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
