"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCancel = exports.postChangePlan = exports.postCheckout = exports.getMe = void 0;
const zod_1 = require("zod");
const async_handler_1 = require("../../utils/async-handler");
const api_error_1 = require("../../utils/api-error");
const config_1 = require("../../config");
const billing_service_1 = require("./billing.service");
const checkoutSchema = zod_1.z.object({
    plan: zod_1.z.string().min(1),
});
exports.getMe = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const data = await (0, billing_service_1.getMySubscription)(req.user.id);
    res.json({ success: true, data });
});
exports.postCheckout = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const { plan } = checkoutSchema.parse(req.body);
    const baseUrl = config_1.config.APP_URL.replace(/\/$/, '');
    const session = await (0, billing_service_1.startCheckout)(req.user.id, plan, `${baseUrl}/billing?checkout=success`, `${baseUrl}/billing?checkout=cancelled`);
    res.json({ success: true, data: session });
});
exports.postChangePlan = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const { plan } = checkoutSchema.parse(req.body);
    const subscription = await (0, billing_service_1.applyPlanToUser)(req.user.id, plan);
    res.json({ success: true, data: subscription });
});
exports.postCancel = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const subscription = await (0, billing_service_1.cancelSubscription)(req.user.id);
    res.json({ success: true, data: subscription });
});
//# sourceMappingURL=billing.controller.js.map