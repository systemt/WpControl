import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { requireSiteQuota } from '../../middlewares/plan-limits';
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
import commandsRoutes from '../commands/commands.routes';

const router = Router();

router.use(requireAuth);

router.get('/', listSitesHandler);
router.get('/:id', validate(idParamSchema, 'params'), getSiteHandler);
router.post('/', requireSiteQuota, validate(createSiteSchema), createSiteHandler);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateSiteSchema), updateSiteHandler);
router.delete('/:id', validate(idParamSchema, 'params'), deleteSiteHandler);

router.get('/:id/plugins', validate(idParamSchema, 'params'), listSitePluginsHandler);
router.get('/:id/themes', validate(idParamSchema, 'params'), listSiteThemesHandler);
router.get('/:id/core', validate(idParamSchema, 'params'), getSiteCoreHandler);

// Nested: POST /api/v1/sites/:id/commands — dispatch a signed command.
router.use('/:id/commands', commandsRoutes);

export default router;
