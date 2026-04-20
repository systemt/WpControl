"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdminsHandler = exports.getMeHandler = void 0;
const async_handler_1 = require("../../utils/async-handler");
const api_error_1 = require("../../utils/api-error");
const admin_users_service_1 = require("./admin-users.service");
exports.getMeHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const user = await (0, admin_users_service_1.getAdminById)(req.user.id);
    if (!user)
        throw api_error_1.ApiError.notFound('User not found');
    res.json({ success: true, data: user });
});
exports.listAdminsHandler = (0, async_handler_1.asyncHandler)(async (_req, res) => {
    const users = await (0, admin_users_service_1.listAdmins)();
    res.json({ success: true, data: users });
});
//# sourceMappingURL=admin-users.controller.js.map