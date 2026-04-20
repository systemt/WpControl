"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const system_controller_1 = require("./system.controller");
const router = (0, express_1.Router)();
router.get('/health', system_controller_1.getHealth);
exports.default = router;
//# sourceMappingURL=system.routes.js.map