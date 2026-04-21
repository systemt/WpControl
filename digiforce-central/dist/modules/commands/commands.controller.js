"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCommandsHandler = exports.postRetry = exports.postDispatch = void 0;
const async_handler_1 = require("../../utils/async-handler");
const api_error_1 = require("../../utils/api-error");
const prisma_1 = require("../../lib/prisma");
const commands_service_1 = require("./commands.service");
/** Queue a fresh command. Returns the new `pending` row — worker picks it up. */
exports.postDispatch = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const siteId = req.params.id;
    if (!siteId)
        throw api_error_1.ApiError.badRequest('Missing site id');
    const command = await (0, commands_service_1.enqueueCommand)({ id: req.user.id, role: req.user.role }, siteId, req.body);
    // 202 Accepted — the dispatch itself has not happened yet.
    res.status(202).json({ success: true, data: command });
});
/** Re-queue a failed command as a new attempt with a link back to the parent. */
exports.postRetry = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const siteId = req.params.id;
    const commandRowId = req.params.commandId;
    if (!siteId || !commandRowId)
        throw api_error_1.ApiError.badRequest('Missing site or command id');
    const retry = await (0, commands_service_1.retryCommand)({ id: req.user.id, role: req.user.role }, siteId, commandRowId);
    res.status(202).json({ success: true, data: retry });
});
exports.listCommandsHandler = (0, async_handler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw api_error_1.ApiError.unauthorized();
    const siteId = req.params.id;
    const site = await prisma_1.prisma.site.findUnique({
        where: { id: siteId },
        select: { id: true, userId: true },
    });
    if (!site)
        throw api_error_1.ApiError.notFound('Site not found');
    if (req.user.role !== 'admin' && site.userId !== req.user.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    const commands = await prisma_1.prisma.siteCommand.findMany({
        where: { siteId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: commands });
});
//# sourceMappingURL=commands.controller.js.map