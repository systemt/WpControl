"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const api_error_1 = require("../utils/api-error");
const config_1 = require("../config");
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof api_error_1.ApiError) {
        res.status(err.status).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
        return;
    }
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            error: {
                code: 'validation_error',
                message: 'Invalid request payload',
                details: err.flatten(),
            },
        });
        return;
    }
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'internal_error',
            message: config_1.config.NODE_ENV === 'production'
                ? 'Internal server error'
                : err instanceof Error
                    ? err.message
                    : 'Internal server error',
        },
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error-handler.js.map