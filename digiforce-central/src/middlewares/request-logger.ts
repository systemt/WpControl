import { RequestHandler } from 'express';

/**
 * Minimal structured-ish request logger. Writes one line per request once the
 * response is fully sent, with method, path, status code, and duration in ms.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - started;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 500) console.error(line);
    else if (res.statusCode >= 400) console.warn(line);
    else console.log(line);
  });
  next();
};
