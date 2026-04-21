import { Router } from 'express';
import { loadAdminUser, requireAdminUI, requireAdminRoleUI } from '../../middlewares/admin-ui';
import { loadImpersonation } from '../../middlewares/impersonation';
import { injectTemplateHelpers } from '../../middlewares/template-helpers';
import {
  getLogin,
  postLogin,
  postLogout,
  getSignup,
  postSignup,
  getDashboard,
  getSitesList,
  getSiteNew,
  postSiteCreate,
  getSiteDetailPage,
  getLogsPage,
  getBillingPage,
  postBillingChangePlan,
  postBillingCancel,
  getAccountPage,
  postDispatchCommand,
  postRetryCommand,
  getAdminUsersPage,
  postImpersonate,
  postStopImpersonation,
} from './admin-ui.controller';

const router = Router();

router.use(injectTemplateHelpers);
router.use(loadAdminUser);
// Impersonation must run AFTER loadAdminUser so it can check admin role.
router.use(loadImpersonation);

// Public auth routes
router.get('/login', getLogin);
router.post('/login', postLogin);
router.get('/signup', getSignup);
router.post('/signup', postSignup);
router.post('/logout', postLogout);

// Authenticated UI — /dashboard is the new canonical landing.
router.get('/dashboard', requireAdminUI, getDashboard);

// Sites management
router.get('/admin', requireAdminUI, getDashboard); // kept as an alias
router.get('/sites', requireAdminUI, getSitesList);
router.get('/sites/new', requireAdminUI, getSiteNew);
router.post('/sites', requireAdminUI, postSiteCreate);
router.get('/sites/:id', requireAdminUI, getSiteDetailPage);

// Command dispatch + retry — accepts POSTs from forms on the site-detail page.
router.post('/sites/:id/commands', requireAdminUI, postDispatchCommand);
router.post('/sites/:id/commands/:commandId/retry', requireAdminUI, postRetryCommand);

// Legacy /admin/sites/* paths redirect to the new flat structure so existing
// bookmarks / flash redirects keep working without a controller rewrite.
router.get('/admin/sites', requireAdminUI, getSitesList);
router.get('/admin/sites/new', requireAdminUI, getSiteNew);
router.post('/admin/sites', requireAdminUI, postSiteCreate);
router.get('/admin/sites/:id', requireAdminUI, getSiteDetailPage);
router.post('/admin/sites/:id/commands', requireAdminUI, postDispatchCommand);
router.post('/admin/sites/:id/commands/:commandId/retry', requireAdminUI, postRetryCommand);

// Logs
router.get('/logs', requireAdminUI, getLogsPage);
router.get('/admin/logs', requireAdminUI, getLogsPage);

// Admin-only: tenant list + impersonation. `requireAdminRoleUI` rejects
// non-admins AND anyone currently impersonating (they appear as role='user').
router.get('/admin/users', requireAdminUI, requireAdminRoleUI, getAdminUsersPage);
router.post('/admin/users/:id/impersonate', requireAdminUI, requireAdminRoleUI, postImpersonate);
// Stop-impersonation is gated by `requireAdminUI` only — the session is the
// impersonated user here, so role is 'user'.
router.post('/stop-impersonation', requireAdminUI, postStopImpersonation);

// Billing + account
router.get('/billing', requireAdminUI, getBillingPage);
router.post('/billing/change-plan', requireAdminUI, postBillingChangePlan);
router.post('/billing/cancel', requireAdminUI, postBillingCancel);
router.get('/account', requireAdminUI, getAccountPage);

export default router;
