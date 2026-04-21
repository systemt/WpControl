import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { loginSchema, signupSchema } from './auth.schema';
import { getMeHandler, postLogin, postLogout, postSignup } from './auth.controller';

const router = Router();

router.post('/signup', validate(signupSchema), postSignup);
router.post('/login', validate(loginSchema), postLogin);
router.post('/logout', postLogout);
router.get('/me', requireAuth, getMeHandler);

export default router;
