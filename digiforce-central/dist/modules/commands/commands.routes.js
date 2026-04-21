"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const commands_schema_1 = require("./commands.schema");
const commands_controller_1 = require("./commands.controller");
// `mergeParams: true` so `req.params.id` (the site id) set on the parent
// router is visible to this sub-router's handlers.
const router = (0, express_1.Router)({ mergeParams: true });
router.use(auth_1.requireAuth);
router.get('/', commands_controller_1.listCommandsHandler);
router.post('/', (0, validate_1.validate)(commands_schema_1.dispatchSchema), commands_controller_1.postDispatch);
router.post('/:commandId/retry', commands_controller_1.postRetry);
exports.default = router;
//# sourceMappingURL=commands.routes.js.map