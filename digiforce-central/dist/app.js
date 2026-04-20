"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const config_1 = require("./config");
const request_logger_1 = require("./middlewares/request-logger");
const error_handler_1 = require("./middlewares/error-handler");
const not_found_1 = require("./middlewares/not-found");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const admin_users_routes_1 = __importDefault(require("./modules/admin-users/admin-users.routes"));
const sites_routes_1 = __importDefault(require("./modules/sites/sites.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const system_routes_1 = __importDefault(require("./modules/system/system.routes"));
const agent_routes_1 = __importDefault(require("./modules/agent/agent.routes"));
const admin_ui_routes_1 = __importDefault(require("./modules/admin-ui/admin-ui.routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    // EJS view engine — views live next to the compiled code so the same
    // relative path works in dev (src/views) and prod (dist/views after copy).
    app.set('view engine', 'ejs');
    app.set('views', path_1.default.join(__dirname, 'views'));
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: config_1.config.CORS_ORIGIN === '*'
            ? true
            : config_1.config.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
        credentials: true,
    }));
    // Cookie parser for the admin UI session cookie.
    app.use((0, cookie_parser_1.default)());
    // URL-encoded body parser for the login form.
    app.use(express_1.default.urlencoded({ extended: false, limit: '1mb' }));
    // JSON parser + raw-body capture for the agent HMAC middleware.
    app.use(express_1.default.json({
        limit: '2mb',
        verify: (req, _res, buf) => {
            req.rawBody = buf.toString('utf8');
        },
    }));
    app.use(request_logger_1.requestLogger);
    // Static admin assets — CSS, future icons, etc.
    app.use('/public', express_1.default.static(path_1.default.join(__dirname, 'public'), { maxAge: '1h' }));
    // REST API (unchanged)
    const api = express_1.default.Router();
    api.use('/auth', auth_routes_1.default);
    api.use('/admin-users', admin_users_routes_1.default);
    api.use('/sites', sites_routes_1.default);
    api.use('/dashboard', dashboard_routes_1.default);
    api.use('/system', system_routes_1.default);
    api.use('/agent', agent_routes_1.default);
    app.use('/api/v1', api);
    // Server-rendered admin UI (login + /admin/*).
    app.use(admin_ui_routes_1.default);
    app.use(not_found_1.notFoundHandler);
    app.use(error_handler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map