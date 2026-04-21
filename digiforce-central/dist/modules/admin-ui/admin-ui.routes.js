"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_ui_1 = require("../../middlewares/admin-ui");
const impersonation_1 = require("../../middlewares/impersonation");
const template_helpers_1 = require("../../middlewares/template-helpers");
const admin_ui_controller_1 = require("./admin-ui.controller");
const router = (0, express_1.Router)();
router.use(template_helpers_1.injectTemplateHelpers);
router.use(admin_ui_1.loadAdminUser);
// Impersonation must run AFTER loadAdminUser so it can check admin role.
router.use(impersonation_1.loadImpersonation);
// Public auth routes
router.get('/login', admin_ui_controller_1.getLogin);
router.post('/login', admin_ui_controller_1.postLogin);
router.get('/signup', admin_ui_controller_1.getSignup);
router.post('/signup', admin_ui_controller_1.postSignup);
router.post('/logout', admin_ui_controller_1.postLogout);
// Authenticated UI — /dashboard is the new canonical landing.
router.get('/dashboard', admin_ui_1.requireAdminUI, admin_ui_controller_1.getDashboard);
// Sites management
router.get('/admin', admin_ui_1.requireAdminUI, admin_ui_controller_1.getDashboard); // kept as an alias
router.get('/sites', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSitesList);
router.get('/sites/new', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSiteNew);
router.post('/sites', admin_ui_1.requireAdminUI, admin_ui_controller_1.postSiteCreate);
router.get('/sites/:id', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSiteDetailPage);
// Command dispatch + retry — accepts POSTs from forms on the site-detail page.
router.post('/sites/:id/commands', admin_ui_1.requireAdminUI, admin_ui_controller_1.postDispatchCommand);
router.post('/sites/:id/commands/:commandId/retry', admin_ui_1.requireAdminUI, admin_ui_controller_1.postRetryCommand);
// Legacy /admin/sites/* paths redirect to the new flat structure so existing
// bookmarks / flash redirects keep working without a controller rewrite.
router.get('/admin/sites', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSitesList);
router.get('/admin/sites/new', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSiteNew);
router.post('/admin/sites', admin_ui_1.requireAdminUI, admin_ui_controller_1.postSiteCreate);
router.get('/admin/sites/:id', admin_ui_1.requireAdminUI, admin_ui_controller_1.getSiteDetailPage);
router.post('/admin/sites/:id/commands', admin_ui_1.requireAdminUI, admin_ui_controller_1.postDispatchCommand);
router.post('/admin/sites/:id/commands/:commandId/retry', admin_ui_1.requireAdminUI, admin_ui_controller_1.postRetryCommand);
// Logs
router.get('/logs', admin_ui_1.requireAdminUI, admin_ui_controller_1.getLogsPage);
router.get('/admin/logs', admin_ui_1.requireAdminUI, admin_ui_controller_1.getLogsPage);
// Admin-only: tenant list + impersonation. `requireAdminRoleUI` rejects
// non-admins AND anyone currently impersonating (they appear as role='user').
router.get('/admin/users', admin_ui_1.requireAdminUI, admin_ui_1.requireAdminRoleUI, admin_ui_controller_1.getAdminUsersPage);
router.post('/admin/users/:id/impersonate', admin_ui_1.requireAdminUI, admin_ui_1.requireAdminRoleUI, admin_ui_controller_1.postImpersonate);
// Stop-impersonation is gated by `requireAdminUI` only — the session is the
// impersonated user here, so role is 'user'.
router.post('/stop-impersonation', admin_ui_1.requireAdminUI, admin_ui_controller_1.postStopImpersonation);
// Billing + account
router.get('/billing', admin_ui_1.requireAdminUI, admin_ui_controller_1.getBillingPage);
router.post('/billing/change-plan', admin_ui_1.requireAdminUI, admin_ui_controller_1.postBillingChangePlan);
router.post('/billing/cancel', admin_ui_1.requireAdminUI, admin_ui_controller_1.postBillingCancel);
router.get('/account', admin_ui_1.requireAdminUI, admin_ui_controller_1.getAccountPage);
exports.default = router;
//# sourceMappingURL=admin-ui.routes.js.map