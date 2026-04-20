import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { createSiteSchema, idParamSchema, updateSiteSchema } from './sites.schema';
import {
  createSiteHandler,
  deleteSiteHandler,
  getSiteCoreHandler,
  getSiteHandler,
  listSitePluginsHandler,
  listSiteThemesHandler,
  listSitesHandler,
  updateSiteHandler,
} from './sites.controller';

const router = Router();

router.use(requireAuth);

router.get('/', listSitesHandler);
router.get('/:id', validate(idParamSchema, 'params'), getSiteHandler);
router.post('/', validate(createSiteSchema), createSiteHandler);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateSiteSchema), updateSiteHandler);
router.delete('/:id', validate(idParamSchema, 'params'), deleteSiteHandler);

// Step 2: read-only snapshot views.
router.get('/:id/plugins', validate(idParamSchema, 'params'), listSitePluginsHandler);
router.get('/:id/themes', validate(idParamSchema, 'params'), listSiteThemesHandler);
router.get('/:id/core', validate(idParamSchema, 'params'), getSiteCoreHandler);

export default router;
