"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_ui_1 = require("../../middlewares/admin-ui");
const template_helpers_1 = require("../../middlewares/template-helpers");
const admin_ui_controller_1 = require("./admin-ui.controller");
const router = (0, express_1.Router)();
// These two run on every admin-UI request (login included) so:
//   • templates always have formatDate/formatRelative/appVersion helpers
//   • `req.user` is set if a valid cookie is present (lets /login redirect)
router.use(template_helpers_1.injectTemplateHelpers);
router.use(admin_ui_1.loadAdminUser);
// Public auth routes
router.get('/login', admin_ui_controller_1.getLogin);
router.post('/login', admin_ui_controller_1.postLogin);
router.post('/logout', admin_ui_controller_1.postLogout);
// Protected admin pages
router.get('/admin', admin_ui_1.requireAdminUI, admin_ui_controller_1.getDashboard);
router.get('/admin/sites', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSitesList);
router.get('/admin/sites/:id', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSiteDetailPage);
router.get('/admin/logs', admin_ui_1.requireAdminUI, admin_ui_controller_1.getLogsPage);
exports.default = router;
//# sourceMappingURL=admin-ui.routes.js.map