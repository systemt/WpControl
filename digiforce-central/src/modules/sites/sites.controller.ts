import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';
import * as service from './sites.service';
import type { CreateSiteInput, UpdateSiteInput } from './sites.schema';

function actorFromReq(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
}

export const listSitesHandler: RequestHandler = asyncHandler(async (req, res) => {
  const sites = await service.listSites(actorFromReq(req));
  res.json({ success: true, data: sites });
});

export const getSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  const site = await service.getSite(actorFromReq(req), req.params.id);
  res.json({ success: true, data: site });
});

export const createSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  const site = await service.createSite(actorFromReq(req), req.body as CreateSiteInput);
  res.status(201).json({ success: true, data: site });
});

export const updateSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  const site = await service.updateSite(actorFromReq(req), req.params.id, req.body as UpdateSiteInput);
  res.json({ success: true, data: site });
});

export const deleteSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  await service.deleteSite(actorFromReq(req), req.params.id);
  res.json({ success: true, data: { message: 'Site deleted' } });
});

export const listSitePluginsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.listSitePlugins(actorFromReq(req), req.params.id);
  res.json({ success: true, data });
});

export const listSiteThemesHandler: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.listSiteThemes(actorFromReq(req), req.params.id);
  res.json({ success: true, data });
});

export const getSiteCoreHandler: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.getSiteCore(actorFromReq(req), req.params.id);
  res.json({ success: true, data });
});
