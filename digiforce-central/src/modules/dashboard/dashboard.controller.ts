import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { getSummary } from './dashboard.service';

export const summaryHandler: RequestHandler = asyncHandler(async (_req, res) => {
  const data = await getSummary();
  res.json({ success: true, data });
});
