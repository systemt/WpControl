import { Router } from 'express';
import { listPublicPlans } from './plans.controller';

const router = Router();

// Public pricing page uses this — no auth required.
router.get('/', listPublicPlans);

export default router;
