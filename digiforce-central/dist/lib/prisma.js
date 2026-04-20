"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const config_1 = require("../config");
// Reuse the client across hot reloads in development.
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.__prisma ??
    new client_1.PrismaClient({
        log: config_1.config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
if (config_1.config.NODE_ENV !== 'production') {
    globalForPrisma.__prisma = exports.prisma;
}
//# sourceMappingURL=prisma.js.map