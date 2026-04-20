"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogsPage = exports.getSiteDetailPage = exports.getSitesList = exports.getDashboard = exports.postLogout = exports.postLogin = exports.getLogin = void 0;
const async_handler_1 = require("../../utils/async-handler");
const config_1 = require("../../config");
const auth_service_1 = require("../auth/auth.service");
const api_error_1 = require("../../utils/api-error");
const admin_ui_1 = require("../../middlewares/admin-ui");
const admin_ui_service_1 = require("./admin-ui.service");
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
function cookieOptions() {
    return {
        httpOnly: true,
        secure: config_1.config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TWELVE_HOURS_MS,
        path: '/',
    };
}
function safeNext(next) {
    if (typeof next !== 'string')
        return '/admin';
    // Only accept same-origin, absolute paths to avoid open-redirect abuse.
    if (!next.startsWith('/') || next.startsWith('//'))
        return '/admin';
    return next;
}
/* ------------------------------------------------------------------------ */
/*  Auth pages                                                               */
/* ------------------------------------------------------------------------ */
const getLogin = (req, res) => {
    if (req.user) {
        res.redirect('/admin');
        return;
    }
    res.render('pages/login', {
        title: 'Sign in',
        error: null,
        email: '',
        next: typeof req.query.next === 'string' ? req.query.next : '',
    });
};
exports.getLogin = getLogin;
exports.postLogin = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const next = safeNext(req.body.next);
    if (!email || !password) {
        res.status(400).render('pages/login', {
            title: 'Sign in',
            error: 'Email and password are required.',
            email,
            next,
        });
        return;
    }
    try {
        const { token } = await (0, auth_service_1.loginAdmin)({ email, password });
        res.cookie(admin_ui_1.ADMIN_COOKIE_NAME, token, cookieOptions());
        res.redirect(next);
    }
    catch (err) {
        const message = err instanceof api_error_1.ApiError && err.status !== 500 ? err.message : 'Invalid email or password.';
        res.status(401).render('pages/login', {
            title: 'Sign in',
            error: message,
            email,
            next,
        });
    }
});
const postLogout = (_req, res) => {
    res.clearCookie(admin_ui_1.ADMIN_COOKIE_NAME, { path: '/' });
    res.redirect('/login');
};
exports.postLogout = postLogout;
/* ------------------------------------------------------------------------ */
/*  Admin pages                                                              */
/* ------------------------------------------------------------------------ */
exports.getDashboard = (0, async_handler_1.asyncHandler)(async (_req, res) => {
    const data = await (0, admin_ui_service_1.loadDashboard)();
    res.render('pages/dashboard', { title: 'Dashboard', ...data });
});
exports.getSitesList = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const sites = await (0, admin_ui_service_1.listSites)({ q, status });
    res.render('pages/sites-list', {
        title: 'Sites',
        sites,
        filters: { q, status },
        statusOptions: ['connected', 'disconnected', 'disabled', 'unknown'],
    });
});
exports.getSiteDetailPage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await (0, admin_ui_service_1.getSiteDetail)(req.params.id);
    res.render('pages/site-detail', {
        title: data.site.name,
        site: data.site,
        plugins: data.plugins,
        themes: data.themes,
        core: data.core,
        logs: data.logs,
    });
});
exports.getLogsPage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const level = typeof req.query.level === 'string' ? req.query.level : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : '';
    const data = await (0, admin_ui_service_1.listLogs)({ level, category, siteId });
    res.render('pages/logs', {
        title: 'Logs',
        logs: data.logs,
        sites: data.sites,
        filters: { level, category, siteId },
        levels: ['info', 'warning', 'error'],
        categories: [
            'security',
            'sync',
            'scan',
            'command',
            'update',
            'system',
            'agent',
            'heartbeat',
            'register',
        ],
    });
});
//# sourceMappingURL=admin-ui.controller.js.map