import type { Request, Response } from 'express';

/**
 * Lightweight flash-messages implementation backed by a short-lived httpOnly
 * cookie. Good enough for a single-process admin UI; swap to a shared session
 * store if the central ever runs multi-process.
 */

export type FlashType = 'info' | 'success' | 'warn' | 'error';

export interface Flash {
  type: FlashType;
  message: string;
  /** Optional extra payload — e.g. a one-time secret to display. */
  data?: Record<string, unknown>;
}

const COOKIE_NAME = 'dfc_flash';
const MAX_AGE_MS = 60_000;

export function setFlash(res: Response, flash: Flash): void {
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
export function consumeFlash(req: Request, res: Response): Flash | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  res.clearCookie(COOKIE_NAME, { path: '/' });
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.type === 'string' &&
      typeof parsed.message === 'string'
    ) {
      return parsed as Flash;
    }
    return null;
  } catch {
    return null;
  }
}
