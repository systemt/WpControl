"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAgentSignature = void 0;
const prisma_1 = require("../lib/prisma");
const config_1 = require("../config");
const api_error_1 = require("../utils/api-error");
const replay_cache_1 = require("../lib/security/replay-cache");
const hmac_1 = require("../lib/security/hmac");
function clientIpFrom(req) {
    const xff = req.header('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0];
        if (first)
            return first.trim();
    }
    return req.ip ?? req.socket.remoteAddress ?? '';
}
async function logSecurityFailure(params) {
    if (params.siteId) {
        try {
            await prisma_1.prisma.siteLog.create({
                data: {
                    siteId: params.siteId,
                    level: 'warning',
                    category: 'security',
                    message: params.message,
                    metaJson: { action: params.action, ...params.context },
                },
            });
        }
        catch (err) {
            // Never let a logging failure mask the original auth failure.
            console.warn('[agent-security] failed to persist security log:', err);
        }
    }
    console.warn(`[agent-security] ${params.action}: ${params.message}`, params.context);
}
const requireAgentSignature = async (req, _res, next) => {
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
            return next(api_error_1.ApiError.unauthorized('Missing required signed headers'));
        }
        const ts = Number.parseInt(timestamp, 10);
        if (!Number.isFinite(ts) || ts <= 0) {
            await logSecurityFailure({
                action: 'invalid_timestamp',
                message: 'Invalid X-Timestamp',
                context: { timestamp, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.unauthorized('Invalid timestamp'));
        }
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - ts) > config_1.config.AGENT_REPLAY_WINDOW_SECONDS) {
            await logSecurityFailure({
                action: 'expired_timestamp',
                message: 'Timestamp outside allowed window',
                context: { timestamp, nowSeconds, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.unauthorized('Request timestamp expired'));
        }
        const cleanRequestId = requestId.replace(/[^A-Za-z0-9._\-]/g, '');
        if (cleanRequestId.length === 0 || cleanRequestId.length > 128) {
            await logSecurityFailure({
                action: 'invalid_request_id',
                message: 'Invalid X-Request-ID',
                context: { requestId, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.unauthorized('Invalid request ID'));
        }
        if (replay_cache_1.replayCache.has(cleanRequestId)) {
            await logSecurityFailure({
                action: 'replay_detected',
                message: 'Replayed X-Request-ID',
                context: { requestId: cleanRequestId, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.unauthorized('Replayed request'));
        }
        const site = await prisma_1.prisma.site.findUnique({
            where: { uuid: siteUuid },
            include: { connection: true },
        });
        if (!site) {
            await logSecurityFailure({
                action: 'unknown_site',
                message: 'Unknown site UUID',
                context: { siteUuid, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.unauthorized('Unknown site'));
        }
        if (!site.connection) {
            await logSecurityFailure({
                siteId: site.id,
                action: 'no_connection',
                message: 'Site has no connection record',
                context: { siteUuid, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.unauthorized('Site connection not configured'));
        }
        if (!site.connection.connectionEnabled) {
            await logSecurityFailure({
                siteId: site.id,
                action: 'connection_disabled',
                message: 'Site connection is disabled',
                context: { siteUuid, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.forbidden('Site connection disabled'));
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
                return next(api_error_1.ApiError.forbidden('IP not allowed'));
            }
        }
        const rawBody = req.rawBody ?? '';
        const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
        const expected = (0, hmac_1.signAgentRequest)({
            secret: site.connection.secretKeyEncrypted,
            body: rawBody,
            timestamp,
            path,
        });
        if (!(0, hmac_1.safeEqualHex)(expected, signature.toLowerCase())) {
            await logSecurityFailure({
                siteId: site.id,
                action: 'invalid_signature',
                message: 'HMAC signature mismatch',
                context: { path, ip: clientIpFrom(req) },
            });
            return next(api_error_1.ApiError.unauthorized('Invalid signature'));
        }
        replay_cache_1.replayCache.add(cleanRequestId);
        req.agent = { site, connection: site.connection };
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.requireAgentSignature = requireAgentSignature;
//# sourceMappingURL=agent-signature.js.map