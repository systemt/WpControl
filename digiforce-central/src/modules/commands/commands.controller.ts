import { RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';
import { prisma } from '../../lib/prisma';
import { enqueueCommand, retryCommand } from './commands.service';
import type { DispatchInput } from './commands.schema';

/** Queue a fresh command. Returns the new `pending` row — worker picks it up. */
export const postDispatch: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const siteId = req.params.id;
  if (!siteId) throw ApiError.badRequest('Missing site id');

  const command = await enqueueCommand(
    { id: req.user.id, role: req.user.role },
    siteId,
    req.body as DispatchInput
  );

  // 202 Accepted — the dispatch itself has not happened yet.
  res.status(202).json({ success: true, data: command });
});

/** Re-queue a failed command as a new attempt with a link back to the parent. */
export const postRetry: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const siteId = req.params.id;
  const commandRowId = req.params.commandId;
  if (!siteId || !commandRowId) throw ApiError.badRequest('Missing site or command id');

  const retry = await retryCommand(
    { id: req.user.id, role: req.user.role },
    siteId,
    commandRowId
  );

  res.status(202).json({ success: true, data: retry });
});

export const listCommandsHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const siteId = req.params.id;
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, userId: true },
  });
  if (!site) throw ApiError.notFound('Site not found');
  if (req.user.role !== 'admin' && site.userId !== req.user.id) {
    throw ApiError.notFound('Site not found');
  }
  const commands = await prisma.siteCommand.findMany({
    where: { siteId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: commands });
});
