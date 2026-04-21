import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('DigiForce Central'),
  APP_VERSION: z.string().min(1).default('1.7.0'),
  APP_URL: z.string().url().default('http://localhost:4000'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('*'),
  AGENT_HEARTBEAT_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  AGENT_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  AGENT_REPLAY_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
  AGENT_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

  // Command queue worker (DB-backed, in-process)
  COMMAND_WORKER_ENABLED: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'boolean' ? v : !['0', 'false', 'no', 'off'].includes(v.toLowerCase())))
    .default(true),
  COMMAND_WORKER_POLL_MS: z.coerce.number().int().positive().default(2_000),
  COMMAND_WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(5),
  COMMAND_WORKER_STALE_LOCK_MS: z.coerce.number().int().positive().default(300_000),

  // Billing
  BILLING_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PRICE_STARTER: z.string().optional().default(''),
  STRIPE_PRICE_PRO: z.string().optional().default(''),
  STRIPE_PRICE_AGENCY: z.string().optional().default(''),

  // Trial defaults for new signups
  DEFAULT_TRIAL_PLAN_SLUG: z.string().default('starter'),
  DEFAULT_TRIAL_DAYS: z.coerce.number().int().nonnegative().default(14),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const [field, errors] of Object.entries(parsed.error.flatten().fieldErrors)) {
    console.error(`  ${field}: ${(errors ?? []).join(', ')}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  jwtExpiresIn: '12h',
};

export type AppConfig = typeof config;
