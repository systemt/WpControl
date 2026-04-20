import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Compute the canonical agent signature:
 *   HMAC_SHA256(body + "|" + timestamp + "|" + path, secret)
 *
 * Callers must pass the *exact* request body string and the *exact* path the
 * other side signed — the central uses `req.originalUrl` minus any query
 * string, the WP agent uses the full REST route (e.g. `/digiforce-agent/v1/…`).
 */
export function signAgentRequest(params: {
  secret: string;
  body: string;
  timestamp: string;
  path: string;
}): string {
  return createHmac('sha256', params.secret)
    .update(`${params.body}|${params.timestamp}|${params.path}`)
    .digest('hex');
}

/**
 * Constant-time comparison. Returns `false` on length mismatch instead of
 * throwing, so a spoofed short signature can't DoS the handler.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
