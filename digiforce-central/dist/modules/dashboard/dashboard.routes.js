"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const dashboard_controller_1 = require("./dashboard.controller");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get('/summary', dashboard_controller_1.summaryHandler);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map