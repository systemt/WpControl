import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import * as service from './sites.service';
import type { CreateSiteInput, UpdateSiteInput } from './sites.schema';

export const listSitesHandler: RequestHandler = asyncHandler(async (_req, res) => {
  const sites = await service.listSites();
  res.json({ success: true, data: sites });
});

export const getSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  const site = await service.getSite(req.params.id);
  res.json({ success: true, data: site });
});

export const createSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  const site = await service.createSite(req.body as CreateSiteInput);
  res.status(201).json({ success: true, data: site });
});

export const updateSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  const site = await service.updateSite(req.params.id, req.body as UpdateSiteInput);
  res.json({ success: true, data: site });
});

export const deleteSiteHandler: RequestHandler = asyncHandler(async (req, res) => {
  await service.deleteSite(req.params.id);
  res.json({ success: true, data: { message: 'Site deleted' } });
});

export const listSitePluginsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.listSitePlugins(req.params.id);
  res.json({ success: true, data });
});

export const listSiteThemesHandler: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.listSiteThemes(req.params.id);
  res.json({ success: true, data });
});

export const getSiteCoreHandler: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.getSiteCore(req.params.id);
  res.json({ success: true, data });
});
