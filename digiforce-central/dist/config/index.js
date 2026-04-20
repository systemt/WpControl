"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const EnvSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    NODE_ENV: zod_1.z.enum(['development', 'test', 'staging', 'production']).default('development'),
    APP_NAME: zod_1.z.string().min(1).default('DigiForce Central'),
    APP_VERSION: zod_1.z.string().min(1).default('1.2.0'),
    APP_URL: zod_1.z.string().url().default('http://localhost:4000'),
    JWT_SECRET: zod_1.z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    CORS_ORIGIN: zod_1.z.string().default('*'),
    AGENT_HEARTBEAT_INTERVAL_MINUTES: zod_1.z.coerce.number().int().positive().default(60),
    AGENT_SYNC_INTERVAL_MINUTES: zod_1.z.coerce.number().int().positive().default(360),
    AGENT_REPLAY_WINDOW_SECONDS: zod_1.z.coerce.number().int().positive().default(300),
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid environment configuration:');
    for (const [field, errors] of Object.entries(parsed.error.flatten().fieldErrors)) {
        console.error(`  ${field}: ${(errors ?? []).join(', ')}`);
    }
    process.exit(1);
}
exports.config = {
    ...parsed.data,
    jwtExpiresIn: '12h',
};
//# sourceMappingURL=index.js.map