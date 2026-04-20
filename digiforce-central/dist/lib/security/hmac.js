"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAgentRequest = signAgentRequest;
exports.safeEqualHex = safeEqualHex;
const crypto_1 = require("crypto");
/**
 * Compute the canonical agent signature:
 *   HMAC_SHA256(body + "|" + timestamp + "|" + path, secret)
 *
 * Callers must pass the *exact* request body string and the *exact* path the
 * other side signed — the central uses `req.originalUrl` minus any query
 * string, the WP agent uses the full REST route (e.g. `/digiforce-agent/v1/…`).
 */
function signAgentRequest(params) {
    return (0, crypto_1.createHmac)('sha256', params.secret)
        .update(`${params.body}|${params.timestamp}|${params.path}`)
        .digest('hex');
}
/**
 * Constant-time comparison. Returns `false` on length mismatch instead of
 * throwing, so a spoofed short signature can't DoS the handler.
 */
function safeEqualHex(a, b) {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(aBuf, bBuf);
}
//# sourceMappingURL=hmac.js.map