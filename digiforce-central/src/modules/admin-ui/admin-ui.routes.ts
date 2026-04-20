import { Router } from 'express';
import { loadAdminUser, requireAdminUI } from '../../middlewares/admin-ui';
import { injectTemplateHelpers } from '../../middlewares/template-helpers';
import {
  getLogin,
  postLogin,
  postLogout,
  getDashboard,
  getSitesList,
  getSiteNew,
  postSiteCreate,
  getSiteDetailPage,
  getLogsPage,
} from './admin-ui.controller';

const router = Router();

router.use(injectTemplateHelpers);
router.use(loadAdminUser);

// Public auth routes
router.get('/login', getLogin);
router.post('/login', postLogin);
router.post('/logout', postLogout);

// Protected admin pages — order matters: /admin/sites/new must come before /:id
router.get('/admin', requireAdminUI, getDashboard);
router.get('/admin/sites/new', requireAdminUI, getSiteNew);
router.post('/admin/sites', requireAdminUI, postSiteCreate);
router.get('/admin/sites', requireAdminUI, getSitesList);
router.get('/admin/sites/:id', requireAdminUI, getSiteDetailPage);
router.get('/admin/logs', requireAdminUI, getLogsPage);

export default router;
