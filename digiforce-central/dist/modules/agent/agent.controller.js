"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSync = exports.postHeartbeat = exports.postRegister = void 0;
const async_handler_1 = require("../../utils/async-handler");
const api_error_1 = require("../../utils/api-error");
const agent_service_1 = require("./agent.service");
function requireAgentContext(req) {
    if (!req.agent)
        throw api_error_1.ApiError.unauthorized('Missing agent context');
    return req.agent;
}
exports.postRegister = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { site, connection } = requireAgentContext(req);
    const data = await (0, agent_service_1.registerAgent)(site, connection, req.body);
    res.json({ success: true, message: 'Site registered successfully', data });
});
exports.postHeartbeat = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { site, connection } = requireAgentContext(req);
    const data = await (0, agent_service_1.processHeartbeat)(site, connection, req.body);
    res.json({ success: true, message: 'Heartbeat received', data });
});
exports.postSync = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { site, connection } = requireAgentContext(req);
    const data = await (0, agent_service_1.processSync)(site, connection, req.body);
    res.json({ success: true, message: 'Sync saved successfully', data });
});
//# sourceMappingURL=agent.controller.js.map