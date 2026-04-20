import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { summaryHandler } from './dashboard.controller';

const router = Router();

router.use(requireAuth);
router.get('/summary', summaryHandler);

export default router;
