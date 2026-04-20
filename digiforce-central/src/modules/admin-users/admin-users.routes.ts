import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getMeHandler, listAdminsHandler } from './admin-users.controller';

const router = Router();

router.use(requireAuth);
router.get('/me', getMeHandler);
router.get('/', listAdminsHandler);

export default router;
