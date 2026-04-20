import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('DigiForce Central'),
  APP_VERSION: z.string().min(1).default('1.1.0'),
  APP_URL: z.string().url().default('http://localhost:4000'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('*'),
  AGENT_HEARTBEAT_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  AGENT_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  AGENT_REPLAY_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
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
