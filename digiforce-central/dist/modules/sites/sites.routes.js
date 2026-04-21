"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const plan_limits_1 = require("../../middlewares/plan-limits");
const validate_1 = require("../../middlewares/validate");
const sites_schema_1 = require("./sites.schema");
const sites_controller_1 = require("./sites.controller");
const commands_routes_1 = __importDefault(require("../commands/commands.routes"));
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get('/', sites_controller_1.listSitesHandler);
router.get('/:id', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.getSiteHandler);
router.post('/', plan_limits_1.requireSiteQuota, (0, validate_1.validate)(sites_schema_1.createSiteSchema), sites_controller_1.createSiteHandler);
router.put('/:id', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), (0, validate_1.validate)(sites_schema_1.updateSiteSchema), sites_controller_1.updateSiteHandler);
router.delete('/:id', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.deleteSiteHandler);
router.get('/:id/plugins', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.listSitePluginsHandler);
router.get('/:id/themes', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.listSiteThemesHandler);
router.get('/:id/core', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.getSiteCoreHandler);
// Nested: POST /api/v1/sites/:id/commands — dispatch a signed command.
router.use('/:id/commands', commands_routes_1.default);
exports.default = router;
//# sourceMappingURL=sites.routes.js.map