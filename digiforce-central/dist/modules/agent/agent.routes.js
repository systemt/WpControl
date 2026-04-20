"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validate_1 = require("../../middlewares/validate");
const agent_signature_1 = require("../../middlewares/agent-signature");
const agent_schema_1 = require("./agent.schema");
const agent_controller_1 = require("./agent.controller");
const router = (0, express_1.Router)();
// Every agent endpoint is signed — the HMAC middleware resolves the Site and
// attaches it to `req.agent` so the handlers can trust the caller.
router.use(agent_signature_1.requireAgentSignature);
router.post('/register', (0, validate_1.validate)(agent_schema_1.registerSchema), agent_controller_1.postRegister);
router.post('/heartbeat', (0, validate_1.validate)(agent_schema_1.heartbeatSchema), agent_controller_1.postHeartbeat);
router.post('/sync', (0, validate_1.validate)(agent_schema_1.syncSchema), agent_controller_1.postSync);
exports.default = router;
//# sourceMappingURL=agent.routes.js.map