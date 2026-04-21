import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { dispatchSchema } from './commands.schema';
import { listCommandsHandler, postDispatch, postRetry } from './commands.controller';

// `mergeParams: true` so `req.params.id` (the site id) set on the parent
// router is visible to this sub-router's handlers.
const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', listCommandsHandler);
router.post('/', validate(dispatchSchema), postDispatch);
router.post('/:commandId/retry', postRetry);

export default router;
