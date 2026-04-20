import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { loginSchema } from './auth.schema';
import { getMeHandler, postLogin, postLogout } from './auth.controller';

const router = Router();

router.post('/login', validate(loginSchema), postLogin);
router.post('/logout', postLogout);
router.get('/me', requireAuth, getMeHandler);

export default router;
