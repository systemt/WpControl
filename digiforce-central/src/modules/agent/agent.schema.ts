import { z } from 'zod';

const environmentEnum = z.enum(['production', 'staging', 'development']);

export const registerSchema = z.object({
  site_uuid: z.string().min(1),
  site_url: z.string().url().optional(),
  site_name: z.string().min(1).optional(),
  admin_email: z.string().email().optional(),
  wordpress_version: z.string().min(1).optional(),
  php_version: z.string().min(1).optional(),
  plugin_version: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  environment: environmentEnum.optional(),
  active_theme: z
    .object({
      name: z.string().optional(),
      version: z.string().optional(),
      stylesheet: z.string().optional(),
    })
    .optional(),
});

export const heartbeatSchema = z.object({
  site_uuid: z.string().min(1),
  plugin_version: z.string().optional(),
  wordpress_version: z.string().optional(),
  php_version: z.string().optional(),
  last_seen_at: z.string().optional(),
  summary: z
    .object({
      plugins_total: z.number().int().nonnegative().optional(),
      plugins_need_update: z.number().int().nonnegative().optional(),
      themes_need_update: z.number().int().nonnegative().optional(),
      core_need_update: z.boolean().optional(),
    })
    .optional(),
});

export const syncSchema = z.object({
  site_uuid: z.string().min(1),
  synced_at: z.string().optional(),
  core: z.object({
    current_version: z.string().min(1),
    latest_version: z.string().min(1),
    has_update: z.boolean(),
    update_type: z.string().nullable().optional(),
  }),
  themes: z
    .array(
      z.object({
        stylesheet: z.string().min(1),
        template: z.string().optional(),
        name: z.string().optional(),
        version_installed: z.string().optional(),
        version_available: z.string().optional(),
        has_update: z.boolean().default(false),
        auto_update_enabled: z.boolean().default(false),
        is_active: z.boolean().default(false),
      })
    )
    .default([]),
  plugins: z
    .array(
      z.object({
        plugin_file: z.string().min(1),
        slug: z.string().optional(),
        name: z.string().optional(),
        version_installed: z.string().optional(),
        version_available: z.string().optional(),
        has_update: z.boolean().default(false),
        is_active: z.boolean().default(false),
        auto_update_enabled: z.boolean().default(false),
        author: z.string().optional(),
        requires_wp: z.string().optional(),
        requires_php: z.string().optional(),
      })
    )
    .default([]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type SyncInput = z.infer<typeof syncSchema>;
