import { Router } from 'express';
import { getHealth } from './system.controller';

const router = Router();

router.get('/health', getHealth);

export default router;
