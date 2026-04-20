import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Validate `req[source]` against a Zod schema. On success the request field is
 * replaced with the parsed value (so defaults and coercions reach the handler).
 * On failure the ZodError is forwarded to the global error handler.
 */
export const validate =
  (schema: ZodSchema, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
