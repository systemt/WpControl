"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const sites_schema_1 = require("./sites.schema");
const sites_controller_1 = require("./sites.controller");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get('/', sites_controller_1.listSitesHandler);
router.get('/:id', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.getSiteHandler);
router.post('/', (0, validate_1.validate)(sites_schema_1.createSiteSchema), sites_controller_1.createSiteHandler);
router.put('/:id', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), (0, validate_1.validate)(sites_schema_1.updateSiteSchema), sites_controller_1.updateSiteHandler);
router.delete('/:id', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.deleteSiteHandler);
// Step 2: read-only snapshot views.
router.get('/:id/plugins', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.listSitePluginsHandler);
router.get('/:id/themes', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.listSiteThemesHandler);
router.get('/:id/core', (0, validate_1.validate)(sites_schema_1.idParamSchema, 'params'), sites_controller_1.getSiteCoreHandler);
exports.default = router;
//# sourceMappingURL=sites.routes.js.map