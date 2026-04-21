"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteCoreHandler = exports.listSiteThemesHandler = exports.listSitePluginsHandler = exports.deleteSiteHandler = exports.updateSiteHandler = exports.createSiteHandler = exports.getSiteHandler = exports.listSitesHandler = void 0;
const async_handler_1 = require("../../utils/async-handler");
const api_error_1 = require("../../utils/api-error");
const service = __importStar(require("./sites.service"));
function actorFromReq(req) {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    return { id: req.user.id, role: req.user.role };
}
exports.listSitesHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const sites = await service.listSites(actorFromReq(req));
    res.json({ success: true, data: sites });
});
exports.getSiteHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const site = await service.getSite(actorFromReq(req), req.params.id);
    res.json({ success: true, data: site });
});
exports.createSiteHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const site = await service.createSite(actorFromReq(req), req.body);
    res.status(201).json({ success: true, data: site });
});
exports.updateSiteHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const site = await service.updateSite(actorFromReq(req), req.params.id, req.body);
    res.json({ success: true, data: site });
});
exports.deleteSiteHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    await service.deleteSite(actorFromReq(req), req.params.id);
    res.json({ success: true, data: { message: 'Site deleted' } });
});
exports.listSitePluginsHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await service.listSitePlugins(actorFromReq(req), req.params.id);
    res.json({ success: true, data });
});
exports.listSiteThemesHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await service.listSiteThemes(actorFromReq(req), req.params.id);
    res.json({ success: true, data });
});
exports.getSiteCoreHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await service.getSiteCore(actorFromReq(req), req.params.id);
    res.json({ success: true, data });
});
//# sourceMappingURL=sites.controller.js.map