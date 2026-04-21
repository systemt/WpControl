"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const billing_controller_1 = require("./billing.controller");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get('/me', billing_controller_1.getMe);
router.post('/checkout', billing_controller_1.postCheckout);
router.post('/change-plan', billing_controller_1.postChangePlan);
router.post('/cancel', billing_controller_1.postCancel);
exports.default = router;
//# sourceMappingURL=billing.routes.js.map