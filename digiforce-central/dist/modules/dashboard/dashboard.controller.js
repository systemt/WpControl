"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summaryHandler = void 0;
const async_handler_1 = require("../../utils/async-handler");
const dashboard_service_1 = require("./dashboard.service");
exports.summaryHandler = (0, async_handler_1.asyncHandler)(async (_req, res) => {
    const data = await (0, dashboard_service_1.getSummary)();
    res.json({ success: true, data });
});
//# sourceMappingURL=dashboard.controller.js.map