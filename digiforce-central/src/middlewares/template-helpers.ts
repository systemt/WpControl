import { RequestHandler } from 'express';
import { config } from '../config';
import { consumeFlash } from '../lib/flash';

/**
 * Expose a small set of helpers and per-request metadata to every EJS render.
 * Templates read them via `res.locals.<name>` (EJS pulls from `res.locals`
 * automatically), so we don't have to pass them in every controller.
 */
export const injectTemplateHelpers: RequestHandler = (req, res, next) => {
  res.locals.formatDate = (value: unknown): string => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  };

  res.locals.formatRelative = (value: unknown): string => {
    if (!value) return 'never';
    const date = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(date.getTime())) return 'never';
    const diff = Date.now() - date.getTime();
    const abs = Math.abs(diff);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (abs < minute) return 'just now';
    if (abs < hour) return `${Math.round(abs / minute)}m ago`;
    if (abs < day) return `${Math.round(abs / hour)}h ago`;
    return `${Math.round(abs / day)}d ago`;
  };

  res.locals.currentPath = req.path;
  res.locals.appVersion = config.APP_VERSION;
  res.locals.appName = config.APP_NAME;

  // Read-and-clear any pending flash so the templates can render it once.
  res.locals.flash = consumeFlash(req, res);

  next();
};
