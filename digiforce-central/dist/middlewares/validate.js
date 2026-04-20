"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
/**
 * Validate `req[source]` against a Zod schema. On success the request field is
 * replaced with the parsed value (so defaults and coercions reach the handler).
 * On failure the ZodError is forwarded to the global error handler.
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
        return next(result.error);
    }
    req[source] = result.data;
    next();
};
exports.validate = validate;
//# sourceMappingURL=validate.js.map