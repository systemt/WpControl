import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAgentSignature } from '../../middlewares/agent-signature';
import { heartbeatSchema, registerSchema, syncSchema } from './agent.schema';
import { postHeartbeat, postRegister, postSync } from './agent.controller';

const router = Router();

// Every agent endpoint is signed — the HMAC middleware resolves the Site and
// attaches it to `req.agent` so the handlers can trust the caller.
router.use(requireAgentSignature);

router.post('/register', validate(registerSchema), postRegister);
router.post('/heartbeat', validate(heartbeatSchema), postHeartbeat);
router.post('/sync', validate(syncSchema), postSync);

export default router;
