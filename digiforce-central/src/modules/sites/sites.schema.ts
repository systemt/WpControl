import { z } from 'zod';

const environmentEnum = z.enum(['production', 'staging', 'development']);
const statusEnum = z.enum(['connected', 'disconnected', 'unknown', 'disabled']);

export const createSiteSchema = z.object({
  uuid: z.string().uuid().optional(),
  name: z.string().min(1).max(191),
  url: z.string().url(),
  environment: environmentEnum.default('production'),
  status: statusEnum.default('unknown'),
  centralNotes: z.string().max(2000).optional(),
  secretKey: z.string().min(16).optional(),
  allowedIps: z.array(z.string().min(1)).default([]),
  requireSignedRequests: z.boolean().default(true),
  connectionEnabled: z.boolean().default(true),
});

export const updateSiteSchema = z
  .object({
    name: z.string().min(1).max(191).optional(),
    url: z.string().url().optional(),
    environment: environmentEnum.optional(),
    status: statusEnum.optional(),
    centralNotes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

export const idParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
