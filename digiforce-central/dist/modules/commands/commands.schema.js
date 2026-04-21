"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchSchema = exports.SUPPORTED_ACTIONS = void 0;
const zod_1 = require("zod");
exports.SUPPORTED_ACTIONS = [
    'sync_status',
    'scan_updates',
    'update_plugin',
    'bulk_update_plugins',
    'activate_plugin',
    'deactivate_plugin',
    'enable_plugin_auto_update',
    'disable_plugin_auto_update',
];
exports.dispatchSchema = zod_1.z.object({
    action: zod_1.z.enum(exports.SUPPORTED_ACTIONS),
    payload: zod_1.z.record(zod_1.z.any()).default({}),
});
//# sourceMappingURL=commands.schema.js.map