"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchCommand = void 0;
exports.enqueueCommand = enqueueCommand;
exports.retryCommand = retryCommand;
exports.processCommand = processCommand;
const crypto_1 = require("crypto");
const prisma_1 = require("../../lib/prisma");
const api_error_1 = require("../../utils/api-error");
const agent_client_1 = require("../../lib/agent-client");
const config_1 = require("../../config");
function assertPayload(action, payload) {
    switch (action) {
        case 'update_plugin':
        case 'activate_plugin':
        case 'deactivate_plugin':
        case 'enable_plugin_auto_update':
        case 'disable_plugin_auto_update': {
            if (typeof payload.plugin_file !== 'string' || payload.plugin_file.trim() === '') {
                throw api_error_1.ApiError.badRequest('plugin_file is required in payload');
            }
            return;
        }
        case 'bulk_update_plugins': {
            if (!Array.isArray(payload.plugin_files) || payload.plugin_files.length === 0) {
                throw api_error_1.ApiError.badRequest('plugin_files must be a non-empty array');
            }
            for (const f of payload.plugin_files) {
                if (typeof f !== 'string' || !f) {
                    throw api_error_1.ApiError.badRequest('plugin_files entries must be non-empty strings');
                }
            }
            return;
        }
        default:
            return;
    }
}
async function ensureActiveSubscription(actor) {
    if (actor.role === 'admin')
        return;
    const sub = await prisma_1.prisma.subscription.findUnique({ where: { userId: actor.id } });
    if (!sub) {
        throw api_error_1.ApiError.forbidden('No active subscription — commands are disabled.');
    }
    if (!['active', 'trialing'].includes(sub.status)) {
        throw api_error_1.ApiError.forbidden(`Subscription is ${sub.status} — commands are disabled.`);
    }
}
/* ------------------------------------------------------------------------ */
/*  1. Enqueue — create a pending row and return. Worker dispatches later.   */
/* ------------------------------------------------------------------------ */
async function enqueueCommand(actor, siteId, input) {
    const site = await prisma_1.prisma.site.findUnique({
        where: { id: siteId },
        include: { connection: { select: { connectionEnabled: true } } },
    });
    if (!site)
        throw api_error_1.ApiError.notFound('Site not found');
    if (actor.role !== 'admin' && site.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Site not found');
    }
    if (!site.connection)
        throw api_error_1.ApiError.badRequest('Site has no connection configured');
    if (!site.connection.connectionEnabled) {
        throw api_error_1.ApiError.badRequest('Site connection is disabled');
    }
    assertPayload(input.action, input.payload);
    await ensureActiveSubscription(actor);
    const commandId = `cmd_${(0, crypto_1.randomUUID)()}`;
    const row = await prisma_1.prisma.siteCommand.create({
        data: {
            siteId,
            userId: actor.id,
            commandId,
            action: input.action,
            payloadJson: input.payload,
            status: 'pending',
            attempt: 1,
        },
    });
    await prisma_1.prisma.siteLog.create({
        data: {
            siteId,
            level: 'info',
            category: 'command',
            message: `Command ${input.action} queued.`,
            metaJson: {
                commandId,
                attempt: 1,
                initiatorUserId: actor.id,
            },
        },
    });
    return row;
}
/**
 * Legacy alias. Old callers expected `dispatchCommand` to block until the
 * agent replied; now they get the freshly-enqueued `pending` row back.
 */
exports.dispatchCommand = enqueueCommand;
/* ------------------------------------------------------------------------ */
/*  2. Retry — create a new row linked to the failed parent for audit.       */
/* ------------------------------------------------------------------------ */
async function retryCommand(actor, siteId, originalCommandRowId) {
    const original = await prisma_1.prisma.siteCommand.findUnique({
        where: { id: originalCommandRowId },
        include: { site: { select: { id: true, userId: true } } },
    });
    if (!original)
        throw api_error_1.ApiError.notFound('Command not found');
    if (original.siteId !== siteId)
        throw api_error_1.ApiError.notFound('Command not found');
    if (actor.role !== 'admin' && original.site.userId !== actor.id) {
        throw api_error_1.ApiError.notFound('Command not found');
    }
    if (original.status !== 'failed') {
        throw api_error_1.ApiError.badRequest('Only failed commands can be retried');
    }
    await ensureActiveSubscription(actor);
    const rootId = original.parentCommandId ?? original.id;
    const commandId = `cmd_${(0, crypto_1.randomUUID)()}`;
    const retryRow = await prisma_1.prisma.siteCommand.create({
        data: {
            siteId: original.siteId,
            userId: actor.id,
            commandId,
            action: original.action,
            payloadJson: original.payloadJson,
            status: 'pending',
            attempt: original.attempt + 1,
            parentCommandId: rootId,
        },
    });
    await prisma_1.prisma.siteLog.create({
        data: {
            siteId: original.siteId,
            level: 'info',
            category: 'command',
            message: `Command ${original.action} retry queued (attempt ${retryRow.attempt}).`,
            metaJson: {
                commandId,
                originalCommandId: original.commandId,
                attempt: retryRow.attempt,
                initiatorUserId: actor.id,
            },
        },
    });
    return retryRow;
}
/* ------------------------------------------------------------------------ */
/*  3. Process — called by the worker after it claims a row (status=processing). */
/* ------------------------------------------------------------------------ */
async function processCommand(commandRowId) {
    const command = await prisma_1.prisma.siteCommand.findUnique({
        where: { id: commandRowId },
        include: { site: { include: { connection: true } } },
    });
    if (!command)
        return;
    if (!command.site || !command.site.connection) {
        await markFailed(command.id, 'invalid_configuration', 'Site has no connection configured');
        return;
    }
    const started = new Date();
    await prisma_1.prisma.siteCommand.update({
        where: { id: command.id },
        data: { startedAt: started },
    });
    const payload = (command.payloadJson ?? {});
    const result = await (0, agent_client_1.sendAgentCommand)({
        site: { url: command.site.url, uuid: command.site.uuid },
        secret: command.site.connection.secretKeyEncrypted,
        commandId: command.commandId,
        action: command.action,
        payload,
        timeoutMs: config_1.config.AGENT_COMMAND_TIMEOUT_MS,
    });
    const agentBody = (result.responseJson ?? null);
    const agentSucceeded = result.ok && !!agentBody && agentBody.success === true;
    if (agentSucceeded) {
        await prisma_1.prisma.siteCommand.update({
            where: { id: command.id },
            data: {
                status: 'succeeded',
                responseJson: (agentBody ?? undefined),
                errorCode: null,
                errorMessage: null,
                finishedAt: new Date(),
                lockedAt: null,
                lockedBy: null,
            },
        });
        await prisma_1.prisma.siteLog.create({
            data: {
                siteId: command.siteId,
                level: 'info',
                category: 'command',
                message: `Command ${command.action} succeeded (attempt ${command.attempt}).`,
                metaJson: {
                    commandId: command.commandId,
                    attempt: command.attempt,
                    httpStatus: result.httpStatus,
                    durationMs: result.durationMs,
                },
            },
        });
        return;
    }
    let errorCode;
    if (result.httpStatus === 0) {
        errorCode = 'network_error';
    }
    else if (agentBody?.error?.code) {
        errorCode = agentBody.error.code;
    }
    else {
        errorCode = `http_${result.httpStatus}`;
    }
    const errorMessage = result.errorMessage ??
        agentBody?.error?.details ??
        agentBody?.message ??
        'Agent returned an error';
    await prisma_1.prisma.siteCommand.update({
        where: { id: command.id },
        data: {
            status: 'failed',
            responseJson: (agentBody ?? undefined),
            errorCode,
            errorMessage,
            finishedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
        },
    });
    await prisma_1.prisma.siteLog.create({
        data: {
            siteId: command.siteId,
            level: 'error',
            category: 'command',
            message: `Command ${command.action} failed (attempt ${command.attempt}, ${errorCode}).`,
            metaJson: {
                commandId: command.commandId,
                attempt: command.attempt,
                httpStatus: result.httpStatus,
                durationMs: result.durationMs,
                errorCode,
            },
        },
    });
}
async function markFailed(commandRowId, errorCode, errorMessage) {
    await prisma_1.prisma.siteCommand.update({
        where: { id: commandRowId },
        data: {
            status: 'failed',
            errorCode,
            errorMessage,
            finishedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
        },
    });
}
//# sourceMappingURL=commands.service.js.map