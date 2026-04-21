import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { prisma } from './lib/prisma';
import { startCommandQueueWorker } from './modules/commands/commands.worker';

async function main() {
  const app = createApp();

  const server = app.listen(config.PORT, () => {
    console.log(
      `[${config.APP_NAME}] v${config.APP_VERSION} listening on port ${config.PORT} (${config.NODE_ENV})`
    );
  });

  // Kick off the DB-backed command queue worker in-process. Render single-dyno
  // deployments get async dispatch without a separate worker process.
  const queueWorker = startCommandQueueWorker();

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down`);
    server.close(async () => {
      try {
        await queueWorker.stop();
      } catch (err) {
        console.error('queue worker stop error:', err);
      }
      try {
        await prisma.$disconnect();
      } finally {
        process.exit(0);
      }
    });
    // Force-exit if graceful shutdown stalls.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
