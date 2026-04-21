"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMeHandler = exports.postLogout = exports.postSignup = exports.postLogin = void 0;
const async_handler_1 = require("../../utils/async-handler");
const api_error_1 = require("../../utils/api-error");
const auth_service_1 = require("./auth.service");
exports.postLogin = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await (0, auth_service_1.loginUser)(req.body);
    res.json({ success: true, data });
});
exports.postSignup = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await (0, auth_service_1.signupUser)(req.body);
    res.status(201).json({ success: true, data });
});
const postLogout = (_req, res) => {
    res.json({ success: true, data: { message: 'Logged out' } });
};
exports.postLogout = postLogout;
exports.getMeHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const user = await (0, auth_service_1.getMe)(req.user.id);
    res.json({ success: true, data: user });
});
//# sourceMappingURL=auth.controller.js.map