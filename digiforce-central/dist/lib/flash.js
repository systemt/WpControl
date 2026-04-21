"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFlash = setFlash;
exports.consumeFlash = consumeFlash;
const COOKIE_NAME = 'dfc_flash';
const MAX_AGE_MS = 60_000;
function setFlash(res, flash) {
    const encoded = Buffer.from(JSON.stringify(flash), 'utf8').toString('base64url');
    res.cookie(COOKIE_NAME, encoded, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: MAX_AGE_MS,
        path: '/',
    });
}
/**
 * Read + clear the flash. Always safe to call; returns null if there's nothing
 * pending. Call exactly once per request (typically from a middleware).
 */
function consumeFlash(req, res) {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw)
        return null;
    res.clearCookie(COOKIE_NAME, { path: '/' });
    try {
        const json = Buffer.from(raw, 'base64url').toString('utf8');
        const parsed = JSON.parse(json);
        if (parsed &&
            typeof parsed === 'object' &&
            typeof parsed.type === 'string' &&
            typeof parsed.message === 'string') {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=flash.js.map