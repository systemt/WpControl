"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const admin_users_controller_1 = require("./admin-users.controller");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get('/me', admin_users_controller_1.getMeHandler);
router.get('/', admin_users_controller_1.listAdminsHandler);
exports.default = router;
//# sourceMappingURL=admin-users.routes.js.map