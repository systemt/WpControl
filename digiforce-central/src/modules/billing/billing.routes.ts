import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { getMe, postCancel, postChangePlan, postCheckout } from './billing.controller';

const router = Router();
router.use(requireAuth);

router.get('/me', getMe);
router.post('/checkout', postCheckout);
router.post('/change-plan', postChangePlan);
router.post('/cancel', postCancel);

export default router;
