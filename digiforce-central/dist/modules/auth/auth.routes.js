"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validate_1 = require("../../middlewares/validate");
const auth_1 = require("../../middlewares/auth");
const auth_schema_1 = require("./auth.schema");
const auth_controller_1 = require("./auth.controller");
const router = (0, express_1.Router)();
router.post('/signup', (0, validate_1.validate)(auth_schema_1.signupSchema), auth_controller_1.postSignup);
router.post('/login', (0, validate_1.validate)(auth_schema_1.loginSchema), auth_controller_1.postLogin);
router.post('/logout', auth_controller_1.postLogout);
router.get('/me', auth_1.requireAuth, auth_controller_1.getMeHandler);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map