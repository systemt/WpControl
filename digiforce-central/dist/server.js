"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const prisma_1 = require("./lib/prisma");
async function main() {
    const app = (0, app_1.createApp)();
    const server = app.listen(config_1.config.PORT, () => {
        console.log(`[${config_1.config.APP_NAME}] v${config_1.config.APP_VERSION} listening on port ${config_1.config.PORT} (${config_1.config.NODE_ENV})`);
    });
    const shutdown = (signal) => {
        console.log(`Received ${signal}, shutting down`);
        server.close(async () => {
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