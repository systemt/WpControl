"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectTemplateHelpers = void 0;
const config_1 = require("../config");
const flash_1 = require("../lib/flash");
/**
 * Expose a small set of helpers and per-request metadata to every EJS render.
 * Templates read them via `res.locals.<name>` (EJS pulls from `res.locals`
 * automatically), so we don't have to pass them in every controller.
 */
const injectTemplateHelpers = (req, res, next) => {
    res.locals.formatDate = (value) => {
        if (!value)
            return '—';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime()))
            return '—';
        return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    };
    res.locals.formatRelative = (value) => {
        if (!value)
            return 'never';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime()))
            return 'never';
        const diff = Date.now() - date.getTime();
        const abs = Math.abs(diff);
        const minute = 60_000;
        const hour = 60 * minute;
        const day = 24 * hour;
        if (abs < minute)
            return 'just now';
        if (abs < hour)
            return `${Math.round(abs / minute)}m ago`;
        if (abs < day)
            return `${Math.round(abs / hour)}h ago`;
        return `${Math.round(abs / day)}d ago`;
    };
    res.locals.currentPath = req.path;
    res.locals.appVersion = config_1.config.APP_VERSION;
    res.locals.appName = config_1.config.APP_NAME;
    // Read-and-clear any pending flash so the templates can render it once.
    res.locals.flash = (0, flash_1.consumeFlash)(req, res);
    next();
};
exports.injectTemplateHelpers = injectTemplateHelpers;
//# sourceMappingURL=template-helpers.js.map