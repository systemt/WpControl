"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.postStopImpersonation = exports.postImpersonate = exports.getAdminUsersPage = exports.postRetryCommand = exports.postDispatchCommand = exports.getAccountPage = exports.postBillingCancel = exports.postBillingChangePlan = exports.getBillingPage = exports.getLogsPage = exports.getSiteDetailPage = exports.postSiteCreate = exports.getSiteNew = exports.getSitesList = exports.getDashboard = exports.postLogout = exports.postSignup = exports.getSignup = exports.postLogin = exports.getLogin = void 0;
const async_handler_1 = require("../../utils/async-handler");
const config_1 = require("../../config");
const auth_service_1 = require("../auth/auth.service");
const api_error_1 = require("../../utils/api-error");
const admin_ui_1 = require("../../middlewares/admin-ui");
const flash_1 = require("../../lib/flash");
const sitesService = __importStar(require("../sites/sites.service"));
const sites_schema_1 = require("../sites/sites.schema");
const prisma_1 = require("../../lib/prisma");
const billing_service_1 = require("../billing/billing.service");
const commands_service_1 = require("../commands/commands.service");
const commands_schema_1 = require("../commands/commands.schema");
const impersonation_1 = require("../../middlewares/impersonation");
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
        return '/dashboard';
    if (!next.startsWith('/') || next.startsWith('//'))
        return '/dashboard';
    return next;
}
function actorFromReq(req) {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    return { id: req.user.id, role: req.user.role };
}
/* ------------------------------------------------------------------------ */
/*  Auth pages                                                               */
/* ------------------------------------------------------------------------ */
const getLogin = (req, res) => {
    if (req.user) {
        res.redirect('/dashboard');
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
        const { token } = await (0, auth_service_1.loginUser)({ email, password });
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
const getSignup = (req, res) => {
    if (req.user) {
        res.redirect('/dashboard');
        return;
    }
    res.render('pages/signup', {
        title: 'Create account',
        values: { name: '', email: '' },
        error: null,
    });
};
exports.getSignup = getSignup;
exports.postSignup = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const name = String(req.body.name ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (!name || !email || password.length < 8) {
        res.status(400).render('pages/signup', {
            title: 'Create account',
            values: { name, email },
            error: 'Enter a name, a valid email, and a password of at least 8 characters.',
        });
        return;
    }
    try {
        const { token } = await (0, auth_service_1.signupUser)({ name, email, password });
        res.cookie(admin_ui_1.ADMIN_COOKIE_NAME, token, cookieOptions());
        (0, flash_1.setFlash)(res, { type: 'success', message: 'Account created — you have a trial on the Starter plan.' });
        res.redirect('/dashboard');
    }
    catch (err) {
        const message = err instanceof api_error_1.ApiError && err.status !== 500 ? err.message : 'Could not create account.';
        res.status(400).render('pages/signup', {
            title: 'Create account',
            values: { name, email },
            error: message,
        });
    }
});
const postLogout = (_req, res) => {
    res.clearCookie(admin_ui_1.ADMIN_COOKIE_NAME, { path: '/' });
    res.redirect('/login');
};
exports.postLogout = postLogout;
/* ------------------------------------------------------------------------ */
/*  Dashboard / sites / logs                                                 */
/* ------------------------------------------------------------------------ */
exports.getDashboard = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await (0, admin_ui_service_1.loadDashboard)(actorFromReq(req));
    res.render('pages/dashboard', { title: 'Dashboard', ...data });
});
exports.getSitesList = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const environment = typeof req.query.env === 'string' ? req.query.env : '';
    const sites = await (0, admin_ui_service_1.listSites)(actorFromReq(req), { q, status, environment });
    // Surface quota so the UI can disable "New site" when the user is at cap.
    let quota = null;
    if (req.user && req.user.role !== 'admin') {
        const sub = await prisma_1.prisma.subscription.findUnique({
            where: { userId: req.user.id },
            include: { plan: true },
        });
        if (sub) {
            const used = await prisma_1.prisma.site.count({ where: { userId: req.user.id } });
            quota = { used, max: sub.plan.maxSites, planName: sub.plan.name };
        }
    }
    res.render('pages/sites-list', {
        title: 'Sites',
        sites,
        filters: { q, status, environment },
        statusOptions: ['connected', 'disconnected', 'disabled', 'unknown'],
        envOptions: ['production', 'staging', 'development'],
        quota,
    });
});
const getSiteNew = (_req, res) => {
    res.render('pages/site-new', {
        title: 'New site',
        values: { name: '', url: '', environment: 'production', centralNotes: '' },
        errors: null,
    });
};
exports.getSiteNew = getSiteNew;
exports.postSiteCreate = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const actor = actorFromReq(req);
    const raw = {
        name: typeof req.body.name === 'string' ? req.body.name : '',
        url: typeof req.body.url === 'string' ? req.body.url : '',
        environment: typeof req.body.environment === 'string' ? req.body.environment : 'production',
        centralNotes: typeof req.body.centralNotes === 'string' ? req.body.centralNotes : '',
    };
    const input = {
        name: raw.name.trim(),
        url: raw.url.trim(),
        environment: raw.environment,
    };
    const notes = raw.centralNotes.trim();
    if (notes)
        input.centralNotes = notes;
    const parsed = sites_schema_1.createSiteSchema.safeParse(input);
    if (!parsed.success) {
        res.status(400).render('pages/site-new', {
            title: 'New site',
            values: raw,
            errors: parsed.error.flatten().fieldErrors,
        });
        return;
    }
    // Plan-quota enforcement at the UI boundary (API layer uses middleware).
    if (actor.role !== 'admin') {
        const sub = await prisma_1.prisma.subscription.findUnique({
            where: { userId: actor.id },
            include: { plan: true },
        });
        if (!sub) {
            res.status(403).render('pages/site-new', {
                title: 'New site',
                values: raw,
                errors: { _form: ['You need an active subscription to add sites. Visit Billing.'] },
            });
            return;
        }
        if (!['active', 'trialing'].includes(sub.status)) {
            res.status(403).render('pages/site-new', {
                title: 'New site',
                values: raw,
                errors: { _form: [`Subscription is ${sub.status}. Update billing to add new sites.`] },
            });
            return;
        }
        if (sub.plan.maxSites !== null) {
            const count = await prisma_1.prisma.site.count({ where: { userId: actor.id } });
            if (count >= sub.plan.maxSites) {
                res.status(403).render('pages/site-new', {
                    title: 'New site',
                    values: raw,
                    errors: {
                        _form: [`Plan limit reached: ${sub.plan.name} allows up to ${sub.plan.maxSites} sites. Upgrade on the Billing page.`],
                    },
                });
                return;
            }
        }
    }
    try {
        const site = await sitesService.createSite(actor, parsed.data);
        (0, flash_1.setFlash)(res, {
            type: 'success',
            message: 'Site created. Save the secret key below — it will not be shown again.',
            data: { secretKey: site.secretKey, siteUuid: site.uuid },
        });
        res.redirect(`/admin/sites/${site.id}`);
    }
    catch (err) {
        if (err instanceof api_error_1.ApiError && err.status === 409) {
            res.status(409).render('pages/site-new', {
                title: 'New site',
                values: raw,
                errors: { _form: [err.message] },
            });
            return;
        }
        throw err;
    }
});
exports.getSiteDetailPage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const data = await (0, admin_ui_service_1.getSiteDetail)(actorFromReq(req), req.params.id);
    res.render('pages/site-detail', {
        title: data.site.name,
        site: data.site,
        plugins: data.plugins,
        themes: data.themes,
        core: data.core,
        logs: data.logs,
        commands: data.commands,
        recentlySeen: data.recentlySeen,
    });
});
exports.getLogsPage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const level = typeof req.query.level === 'string' ? req.query.level : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : '';
    const data = await (0, admin_ui_service_1.listLogs)(actorFromReq(req), { level, category, siteId });
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
/* ------------------------------------------------------------------------ */
/*  Billing / account                                                        */
/* ------------------------------------------------------------------------ */
exports.getBillingPage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const [plans, { subscription, usage }] = await Promise.all([
        prisma_1.prisma.plan.findMany({ where: { isPublic: true }, orderBy: { sortOrder: 'asc' } }),
        (0, billing_service_1.getMySubscription)(req.user.id),
    ]);
    res.render('pages/billing', {
        title: 'Billing',
        plans,
        subscription,
        usage,
    });
});
exports.postBillingChangePlan = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const planSlug = String(req.body.plan ?? '').trim();
    if (!planSlug) {
        (0, flash_1.setFlash)(res, { type: 'error', message: 'Choose a plan first.' });
        res.redirect('/billing');
        return;
    }
    try {
        await (0, billing_service_1.applyPlanToUser)(req.user.id, planSlug);
        (0, flash_1.setFlash)(res, { type: 'success', message: 'Subscription updated.' });
    }
    catch (err) {
        const msg = err instanceof api_error_1.ApiError ? err.message : 'Could not change plan.';
        (0, flash_1.setFlash)(res, { type: 'error', message: msg });
    }
    res.redirect('/billing');
});
exports.postBillingCancel = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    try {
        await (0, billing_service_1.cancelSubscription)(req.user.id);
        (0, flash_1.setFlash)(res, { type: 'warn', message: 'Subscription cancelled. Existing sites remain visible but new sites cannot be added.' });
    }
    catch (err) {
        const msg = err instanceof api_error_1.ApiError ? err.message : 'Could not cancel subscription.';
        (0, flash_1.setFlash)(res, { type: 'error', message: msg });
    }
    res.redirect('/billing');
});
exports.getAccountPage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true },
    });
    res.render('pages/account', {
        title: 'Account',
        account: user,
    });
});
/* ------------------------------------------------------------------------ */
/*  Command dispatch (admin-UI form posts)                                   */
/* ------------------------------------------------------------------------ */
/**
 * Handle the HTML form submissions on the site-detail page for sync_status,
 * scan_updates, update_plugin, activate_plugin, deactivate_plugin, and the
 * two auto-update toggles. All failures land as a flash — we never 500 the
 * browser on a bad agent response.
 */
exports.postDispatchCommand = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const siteId = req.params.id;
    const redirectBack = `/admin/sites/${encodeURIComponent(siteId)}`;
    const action = typeof req.body.action === 'string' ? req.body.action : '';
    // Build the action-specific payload from the form fields that are present.
    const payload = {};
    if (typeof req.body.plugin_file === 'string' && req.body.plugin_file.trim()) {
        payload.plugin_file = req.body.plugin_file.trim();
    }
    if (Array.isArray(req.body.plugin_files)) {
        payload.plugin_files = req.body.plugin_files.filter((v) => typeof v === 'string' && v.trim() !== '');
    }
    const parsed = commands_schema_1.dispatchSchema.safeParse({ action, payload });
    if (!parsed.success) {
        (0, flash_1.setFlash)(res, { type: 'error', message: 'Invalid command.' });
        res.redirect(redirectBack);
        return;
    }
    try {
        await (0, commands_service_1.enqueueCommand)({ id: req.user.id, role: req.user.role }, siteId, parsed.data);
        (0, flash_1.setFlash)(res, {
            type: 'success',
            message: `Command ${parsed.data.action} queued. The status will update in the commands table shortly.`,
        });
    }
    catch (err) {
        const msg = err instanceof api_error_1.ApiError ? err.message : 'Command dispatch failed.';
        (0, flash_1.setFlash)(res, { type: 'error', message: msg });
    }
    res.redirect(redirectBack);
});
/**
 * Re-queue a failed command. Only `status='failed'` rows are retryable. Each
 * retry creates a NEW SiteCommand row (attempt++), linked to the original via
 * `parentCommandId`, so the audit trail is preserved.
 */
exports.postRetryCommand = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const siteId = req.params.id;
    const commandRowId = req.params.commandId;
    const redirectBack = `/admin/sites/${encodeURIComponent(siteId)}`;
    try {
        const retry = await (0, commands_service_1.retryCommand)({ id: req.user.id, role: req.user.role }, siteId, commandRowId);
        (0, flash_1.setFlash)(res, {
            type: 'success',
            message: `Retry queued for ${retry.action} (attempt ${retry.attempt}).`,
        });
    }
    catch (err) {
        const msg = err instanceof api_error_1.ApiError ? err.message : 'Retry failed.';
        (0, flash_1.setFlash)(res, { type: 'error', message: msg });
    }
    res.redirect(redirectBack);
});
/* ------------------------------------------------------------------------ */
/*  Admin-only: users list + impersonation                                   */
/* ------------------------------------------------------------------------ */
exports.getAdminUsersPage = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const users = await (0, admin_ui_service_1.listAllUsers)();
    res.render('pages/admin-users', {
        title: 'Users',
        users,
        currentUserId: req.user.id,
    });
});
/**
 * Start impersonating another user. Requires a REAL admin session — impersonated
 * admins (if we ever allow that) would appear as role='user' here and fail the
 * role check in the route layer.
 */
exports.postImpersonate = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    // Guard against nesting — if `req.originalAdmin` is set, the middleware
    // already swapped us, meaning this admin is currently impersonating someone
    // else. Require them to stop first.
    if (req.originalAdmin) {
        (0, flash_1.setFlash)(res, { type: 'error', message: 'Stop the current impersonation before starting a new one.' });
        res.redirect('/admin/users');
        return;
    }
    const targetId = req.params.id;
    if (!targetId) {
        (0, flash_1.setFlash)(res, { type: 'error', message: 'Missing user id.' });
        res.redirect('/admin/users');
        return;
    }
    if (targetId === req.user.id) {
        (0, flash_1.setFlash)(res, { type: 'error', message: 'You cannot impersonate yourself.' });
        res.redirect('/admin/users');
        return;
    }
    const target = await prisma_1.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || !target.isActive) {
        (0, flash_1.setFlash)(res, { type: 'error', message: 'User not found or inactive.' });
        res.redirect('/admin/users');
        return;
    }
    if (target.role === 'admin') {
        (0, flash_1.setFlash)(res, { type: 'error', message: 'Cannot impersonate another administrator.' });
        res.redirect('/admin/users');
        return;
    }
    const token = (0, impersonation_1.signImpersonationToken)(req.user.id, target.id);
    res.cookie(impersonation_1.IMPERSONATION_COOKIE_NAME, token, (0, impersonation_1.impersonationCookieOptions)());
    await prisma_1.prisma.auditLog.create({
        data: {
            actorUserId: req.user.id,
            targetUserId: target.id,
            action: 'impersonation_start',
            meta: {
                targetEmail: target.email,
                targetName: target.name,
                adminEmail: req.user.email,
            },
        },
    });
    (0, flash_1.setFlash)(res, {
        type: 'warn',
        message: `You are now impersonating ${target.name} (${target.email}).`,
    });
    res.redirect('/dashboard');
});
/**
 * Stop impersonating. Runs under `requireAdminUI` only — not the role gate —
 * because during impersonation the user appears as the impersonated user.
 * Clears the cookie regardless of state, and audits when the middleware saw
 * an active impersonation (`req.originalAdmin`).
 */
exports.postStopImpersonation = (0, async_handler_1.asyncHandler)(async (req, res) => {
    // `loadImpersonation` populates `req.originalAdmin` + `res.locals.impersonation`.
    const locals = res.locals;
    const impersonated = locals.impersonation;
    res.clearCookie(impersonation_1.IMPERSONATION_COOKIE_NAME, { path: '/' });
    if (req.originalAdmin && impersonated?.impersonatedId) {
        await prisma_1.prisma.auditLog.create({
            data: {
                actorUserId: req.originalAdmin.id,
                targetUserId: impersonated.impersonatedId,
                action: 'impersonation_stop',
                meta: {
                    targetEmail: impersonated.impersonatedEmail ?? null,
                    adminEmail: req.originalAdmin.email,
                },
            },
        });
    }
    (0, flash_1.setFlash)(res, { type: 'info', message: 'Stopped impersonation.' });
    res.redirect('/admin/users');
});
//# sourceMappingURL=admin-ui.controller.js.map