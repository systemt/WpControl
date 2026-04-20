import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { ApiError } from '../../utils/api-error';
import {
  processHeartbeat,
  processSync,
  registerAgent,
} from './agent.service';
import type {
  HeartbeatInput,
  RegisterInput,
  SyncInput,
} from './agent.schema';

function requireAgentContext(req: Request) {
  if (!req.agent) throw ApiError.unauthorized('Missing agent context');
  return req.agent;
}

export const postRegister: RequestHandler = asyncHandler(async (req, res) => {
  const { site, connection } = requireAgentContext(req);
  const data = await registerAgent(site, connection, req.body as RegisterInput);
  res.json({ success: true, message: 'Site registered successfully', data });
});

export const postHeartbeat: RequestHandler = asyncHandler(async (req, res) => {
  const { site, connection } = requireAgentContext(req);
  const data = await processHeartbeat(site, connection, req.body as HeartbeatInput);
  res.json({ success: true, message: 'Heartbeat received', data });
});

export const postSync: RequestHandler = asyncHandler(async (req, res) => {
  const { site, connection } = requireAgentContext(req);
  const data = await processSync(site, connection, req.body as SyncInput);
  res.json({ success: true, message: 'Sync saved successfully', data });
});
