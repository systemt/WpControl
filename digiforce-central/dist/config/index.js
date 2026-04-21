"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const EnvSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    NODE_ENV: zod_1.z.enum(['development', 'test', 'staging', 'production']).default('development'),
    APP_NAME: zod_1.z.string().min(1).default('DigiForce Central'),
    APP_VERSION: zod_1.z.string().min(1).default('1.7.0'),
    APP_URL: zod_1.z.string().url().default('http://localhost:4000'),
    JWT_SECRET: zod_1.z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    CORS_ORIGIN: zod_1.z.string().default('*'),
    AGENT_HEARTBEAT_INTERVAL_MINUTES: zod_1.z.coerce.number().int().positive().default(60),
    AGENT_SYNC_INTERVAL_MINUTES: zod_1.z.coerce.number().int().positive().default(360),
    AGENT_REPLAY_WINDOW_SECONDS: zod_1.z.coerce.number().int().positive().default(300),
    AGENT_COMMAND_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(45_000),
    // Command queue worker (DB-backed, in-process)
    COMMAND_WORKER_ENABLED: zod_1.z
        .union([zod_1.z.boolean(), zod_1.z.string()])
        .transform((v) => (typeof v === 'boolean' ? v : !['0', 'false', 'no', 'off'].includes(v.toLowerCase())))
        .default(true),
    COMMAND_WORKER_POLL_MS: zod_1.z.coerce.number().int().positive().default(2_000),
    COMMAND_WORKER_BATCH_SIZE: zod_1.z.coerce.number().int().positive().default(5),
    COMMAND_WORKER_STALE_LOCK_MS: zod_1.z.coerce.number().int().positive().default(300_000),
    // Billing
    BILLING_PROVIDER: zod_1.z.enum(['mock', 'stripe']).default('mock'),
    STRIPE_SECRET_KEY: zod_1.z.string().optional().default(''),
    STRIPE_WEBHOOK_SECRET: zod_1.z.string().optional().default(''),
    STRIPE_PRICE_STARTER: zod_1.z.string().optional().default(''),
    STRIPE_PRICE_PRO: zod_1.z.string().optional().default(''),
    STRIPE_PRICE_AGENCY: zod_1.z.string().optional().default(''),
    // Trial defaults for new signups
    DEFAULT_TRIAL_PLAN_SLUG: zod_1.z.string().default('starter'),
    DEFAULT_TRIAL_DAYS: zod_1.z.coerce.number().int().nonnegative().default(14),
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