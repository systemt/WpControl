"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const config_1 = require("./config");
const prisma_1 = require("./lib/prisma");
const commands_worker_1 = require("./modules/commands/commands.worker");
async function main() {
    const app = (0, app_1.createApp)();
    const server = app.listen(config_1.config.PORT, () => {
        console.log(`[${config_1.config.APP_NAME}] v${config_1.config.APP_VERSION} listening on port ${config_1.config.PORT} (${config_1.config.NODE_ENV})`);
    });
    // Kick off the DB-backed command queue worker in-process. Render single-dyno
    // deployments get async dispatch without a separate worker process.
    const queueWorker = (0, commands_worker_1.startCommandQueueWorker)();
    const shutdown = (signal) => {
        console.log(`Received ${signal}, shutting down`);
        server.close(async () => {
            try {
                await queueWorker.stop();
            }
            catch (err) {
                console.error('queue worker stop error:', err);
            }
            try {
                await prisma_1.prisma.$disconnect();
            }
            finally {
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
//# sourceMappingURL=server.js.map