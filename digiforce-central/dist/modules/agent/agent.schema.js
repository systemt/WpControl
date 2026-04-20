"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSchema = exports.heartbeatSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const environmentEnum = zod_1.z.enum(['production', 'staging', 'development']);
exports.registerSchema = zod_1.z.object({
    site_uuid: zod_1.z.string().min(1),
    site_url: zod_1.z.string().url().optional(),
    site_name: zod_1.z.string().min(1).optional(),
    admin_email: zod_1.z.string().email().optional(),
    wordpress_version: zod_1.z.string().min(1).optional(),
    php_version: zod_1.z.string().min(1).optional(),
    plugin_version: zod_1.z.string().min(1).optional(),
    locale: zod_1.z.string().min(1).optional(),
    timezone: zod_1.z.string().min(1).optional(),
    environment: environmentEnum.optional(),
    active_theme: zod_1.z
        .object({
        name: zod_1.z.string().optional(),
        version: zod_1.z.string().optional(),
        stylesheet: zod_1.z.string().optional(),
    })
        .optional(),
});
exports.heartbeatSchema = zod_1.z.object({
    site_uuid: zod_1.z.string().min(1),
    plugin_version: zod_1.z.string().optional(),
    wordpress_version: zod_1.z.string().optional(),
    php_version: zod_1.z.string().optional(),
    last_seen_at: zod_1.z.string().optional(),
    summary: zod_1.z
        .object({
        plugins_total: zod_1.z.number().int().nonnegative().optional(),
        plugins_need_update: zod_1.z.number().int().nonnegative().optional(),
        themes_need_update: zod_1.z.number().int().nonnegative().optional(),
        core_need_update: zod_1.z.boolean().optional(),
    })
        .optional(),
});
exports.syncSchema = zod_1.z.object({
    site_uuid: zod_1.z.string().min(1),
    synced_at: zod_1.z.string().optional(),
    core: zod_1.z.object({
        current_version: zod_1.z.string().min(1),
        latest_version: zod_1.z.string().min(1),
        has_update: zod_1.z.boolean(),
        update_type: zod_1.z.string().nullable().optional(),
    }),
    themes: zod_1.z
        .array(zod_1.z.object({
        stylesheet: zod_1.z.string().min(1),
        template: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        version_installed: zod_1.z.string().optional(),
        version_available: zod_1.z.string().optional(),
        has_update: zod_1.z.boolean().default(false),
        auto_update_enabled: zod_1.z.boolean().default(false),
        is_active: zod_1.z.boolean().default(false),
    }))
        .default([]),
    plugins: zod_1.z
        .array(zod_1.z.object({
        plugin_file: zod_1.z.string().min(1),
        slug: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        version_installed: zod_1.z.string().optional(),
        version_available: zod_1.z.string().optional(),
        has_update: zod_1.z.boolean().default(false),
        is_active: zod_1.z.boolean().default(false),
        auto_update_enabled: zod_1.z.boolean().default(false),
        author: zod_1.z.string().optional(),
        requires_wp: zod_1.z.string().optional(),
        requires_php: zod_1.z.string().optional(),
    }))
        .default([]),
});
//# sourceMappingURL=agent.schema.js.map