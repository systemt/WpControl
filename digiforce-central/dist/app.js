"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
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
function createApp() {
    const app = (0, express_1.default)();
    app.disable('x-powered-by');
    // Trust the first proxy hop so req.ip / X-Forwarded-For is meaningful when
    // deployed behind a single load balancer. Override in .env-driven deploys.
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: config_1.config.CORS_ORIGIN === '*'
            ? true
            : config_1.config.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
        credentials: true,
    }));
    // Capture the exact raw request body so the agent signature middleware can
    // verify HMAC over the same bytes the WP plugin signed. Doesn't affect
    // downstream handlers — req.body is still the parsed JSON.
    app.use(express_1.default.json({
        limit: '2mb',
        verify: (req, _res, buf) => {
            // The `verify` callback receives http.IncomingMessage; we stash the raw
            // body as a string so the agent signature middleware can verify HMAC
            // over the exact bytes. Narrow-cast avoids coupling to express.Request.
            req.rawBody = buf.toString('utf8');
        },
    }));
    app.use(request_logger_1.requestLogger);
    const api = express_1.default.Router();
    api.use('/auth', auth_routes_1.default);
    api.use('/admin-users', admin_users_routes_1.default);
    api.use('/sites', sites_routes_1.default);
    api.use('/dashboard', dashboard_routes_1.default);
    api.use('/system', system_routes_1.default);
    api.use('/agent', agent_routes_1.default);
    app.use('/api/v1', api);
    app.use(not_found_1.notFoundHandler);
    app.use(error_handler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map