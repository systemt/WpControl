import { createApp } from './app';
import { config } from './config';
import { prisma } from './lib/prisma';

async function main() {
  const app = createApp();

  const server = app.listen(config.PORT, () => {
    console.log(
      `[${config.APP_NAME}] v${config.APP_VERSION} listening on port ${config.PORT} (${config.NODE_ENV})`
    );
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down`);
    server.close(async () => {
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
