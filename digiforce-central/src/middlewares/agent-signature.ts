import type { Request, RequestHandler } from 'express';
import type { Site, SiteConnection } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { ApiError } from '../utils/api-error';
import { replayCache } from '../lib/security/replay-cache';
import { safeEqualHex, signAgentRequest } from '../lib/security/hmac';

declare module 'express-serve-static-core' {
  interface Request {
    agent?: {
      site: Site;
      connection: SiteConnection;
    };
    rawBody?: string;
  }
}

function clientIpFrom(req: Request): string {
  const xff = req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? '';
}

async function logSecurityFailure(params: {
  siteId?: string;
  action: string;
  message: string;
  context: Record<string, unknown>;
}): Promise<void> {
  if (params.siteId) {
    try {
      await prisma.siteLog.create({
        data: {
          siteId: params.siteId,
          level: 'warning',
          category: 'security',
          message: params.message,
          metaJson: { action: params.action, ...params.context },
        },
      });
    } catch (err) {
      // Never let a logging failure mask the original auth failure.
      console.warn('[agent-security] failed to persist security log:', err);
    }
  }
  console.warn(`[agent-security] ${params.action}: ${params.message}`, params.context);
}

export const requireAgentSignature: RequestHandler = async (req, _res, next) => {
  try {
    const siteUuid = req.header('x-site-uuid');
    const timestamp = req.header('x-timestamp');
    const requestId = req.header('x-request-id');
    const signature = req.header('x-signature');

    if (!siteUuid || !timestamp || !requestId || !signature) {
      await logSecurityFailure({
        action: 'missing_headers',
        message: 'Missing required signed headers',
        context: {
          hasSiteUuid: !!siteUuid,
          hasTimestamp: !!timestamp,
          hasRequestId: !!requestId,
          hasSignature: !!signature,
          ip: clientIpFrom(req),
        },
      });
      return next(ApiError.unauthorized('Missing required signed headers'));
    }

    const ts = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(ts) || ts <= 0) {
      await logSecurityFailure({
        action: 'invalid_timestamp',
        message: 'Invalid X-Timestamp',
        context: { timestamp, ip: clientIpFrom(req) },
      });
      return next(ApiError.unauthorized('Invalid timestamp'));
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - ts) > config.AGENT_REPLAY_WINDOW_SECONDS) {
      await logSecurityFailure({
        action: 'expired_timestamp',
        message: 'Timestamp outside allowed window',
        context: { timestamp, nowSeconds, ip: clientIpFrom(req) },
      });
      return next(ApiError.unauthorized('Request timestamp expired'));
    }

    const cleanRequestId = requestId.replace(/[^A-Za-z0-9._\-]/g, '');
    if (cleanRequestId.length === 0 || cleanRequestId.length > 128) {
      await logSecurityFailure({
        action: 'invalid_request_id',
        message: 'Invalid X-Request-ID',
        context: { requestId, ip: clientIpFrom(req) },
      });
      return next(ApiError.unauthorized('Invalid request ID'));
    }

    if (replayCache.has(cleanRequestId)) {
      await logSecurityFailure({
        action: 'replay_detected',
        message: 'Replayed X-Request-ID',
        context: { requestId: cleanRequestId, ip: clientIpFrom(req) },
      });
      return next(ApiError.unauthorized('Replayed request'));
    }

    const site = await prisma.site.findUnique({
      where: { uuid: siteUuid },
      include: { connection: true },
    });

    if (!site) {
      await logSecurityFailure({
        action: 'unknown_site',
        message: 'Unknown site UUID',
        context: { siteUuid, ip: clientIpFrom(req) },
      });
      return next(ApiError.unauthorized('Unknown site'));
    }

    if (!site.connection) {
      await logSecurityFailure({
        siteId: site.id,
        action: 'no_connection',
        message: 'Site has no connection record',
        context: { siteUuid, ip: clientIpFrom(req) },
      });
      return next(ApiError.unauthorized('Site connection not configured'));
    }

    if (!site.connection.connectionEnabled) {
      await logSecurityFailure({
        siteId: site.id,
        action: 'connection_disabled',
        message: 'Site connection is disabled',
        context: { siteUuid, ip: clientIpFrom(req) },
      });
      return next(ApiError.forbidden('Site connection disabled'));
    }

    if (site.connection.allowedIps.length > 0) {
      const clientIp = clientIpFrom(req);
      if (!clientIp || !site.connection.allowedIps.includes(clientIp)) {
        await logSecurityFailure({
          siteId: site.id,
          action: 'ip_blocked',
          message: 'Client IP not in allowlist',
          context: { clientIp, allowedIps: site.connection.allowedIps },
        });
        return next(ApiError.forbidden('IP not allowed'));
      }
    }

    const rawBody = req.rawBody ?? '';
    const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
    const expected = signAgentRequest({
      secret: site.connection.secretKeyEncrypted,
      body: rawBody,
      timestamp,
      path,
    });

    if (!safeEqualHex(expected, signature.toLowerCase())) {
      await logSecurityFailure({
        siteId: site.id,
        action: 'invalid_signature',
        message: 'HMAC signature mismatch',
        context: { path, ip: clientIpFrom(req) },
      });
      return next(ApiError.unauthorized('Invalid signature'));
    }

    replayCache.add(cleanRequestId);
    req.agent = { site, connection: site.connection };

    next();
  } catch (err) {
    next(err);
  }
};
