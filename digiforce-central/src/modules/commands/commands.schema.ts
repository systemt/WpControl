import { z } from 'zod';

export const SUPPORTED_ACTIONS = [
  'sync_status',
  'scan_updates',
  'update_plugin',
  'bulk_update_plugins',
  'activate_plugin',
  'deactivate_plugin',
  'enable_plugin_auto_update',
  'disable_plugin_auto_update',
] as const;

export const dispatchSchema = z.object({
  action: z.enum(SUPPORTED_ACTIONS),
  payload: z.record(z.any()).default({}),
});

export type DispatchInput = z.infer<typeof dispatchSchema>;
export type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];
