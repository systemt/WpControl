import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';

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

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  // Trust the first proxy hop so req.ip / X-Forwarded-For is meaningful when
  // deployed behind a single load balancer. Override in .env-driven deploys.
  app.set('trust proxy', 1);

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

  // Capture the exact raw request body so the agent signature middleware can
  // verify HMAC over the same bytes the WP plugin signed. Doesn't affect
  // downstream handlers — req.body is still the parsed JSON.
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        // The `verify` callback receives http.IncomingMessage; we stash the raw
        // body as a string so the agent signature middleware can verify HMAC
        // over the exact bytes. Narrow-cast avoids coupling to express.Request.
        (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(requestLogger);

  const api = express.Router();
  api.use('/auth', authRoutes);
  api.use('/admin-users', adminUsersRoutes);
  api.use('/sites', sitesRoutes);
  api.use('/dashboard', dashboardRoutes);
  api.use('/system', systemRoutes);
  api.use('/agent', agentRoutes);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
