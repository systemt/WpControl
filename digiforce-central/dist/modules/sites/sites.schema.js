"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idParamSchema = exports.updateSiteSchema = exports.createSiteSchema = void 0;
const zod_1 = require("zod");
const environmentEnum = zod_1.z.enum(['production', 'staging', 'development']);
const statusEnum = zod_1.z.enum(['connected', 'disconnected', 'unknown', 'disabled']);
exports.createSiteSchema = zod_1.z.object({
    uuid: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(1).max(191),
    url: zod_1.z.string().url(),
    environment: environmentEnum.default('production'),
    status: statusEnum.default('unknown'),
    centralNotes: zod_1.z.string().max(2000).optional(),
    secretKey: zod_1.z.string().min(16).optional(),
    allowedIps: zod_1.z.array(zod_1.z.string().min(1)).default([]),
    requireSignedRequests: zod_1.z.boolean().default(true),
    connectionEnabled: zod_1.z.boolean().default(true),
});
exports.updateSiteSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(191).optional(),
    url: zod_1.z.string().url().optional(),
    environment: environmentEnum.optional(),
    status: statusEnum.optional(),
    centralNotes: zod_1.z.string().max(2000).nullable().optional(),
})
    .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
});
exports.idParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
});
//# sourceMappingURL=sites.schema.js.map