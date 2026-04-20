import { Router } from 'express';
import { loadAdminUser, requireAdminUI } from '../../middlewares/admin-ui';
import { injectTemplateHelpers } from '../../middlewares/template-helpers';
import {
  getLogin,
  postLogin,
  postLogout,
  getDashboard,
  getSitesList,
  getSiteDetailPage,
  getLogsPage,
} from './admin-ui.controller';

const router = Router();

// These two run on every admin-UI request (login included) so:
//   • templates always have formatDate/formatRelative/appVersion helpers
//   • `req.user` is set if a valid cookie is present (lets /login redirect)
router.use(injectTemplateHelpers);
router.use(loadAdminUser);

// Public auth routes
router.get('/login', getLogin);
router.post('/login', postLogin);
router.post('/logout', postLogout);

// Protected admin pages
router.get('/admin', requireAdminUI, getDashboard);
router.get('/admin/sites', requireAdminUI, getSitesList);
router.get('/admin/sites/:id', requireAdminUI, getSiteDetailPage);
router.get('/admin/logs', requireAdminUI, getLogsPage);

export default router;
