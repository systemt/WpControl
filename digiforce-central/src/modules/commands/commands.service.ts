import { randomUUID } from 'crypto';
import type { SiteCommand } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/api-error';
import { sendAgentCommand } from '../../lib/agent-client';
import { config } from '../../config';
import type { DispatchInput } from './commands.schema';

export interface DispatchActor {
  id: string;
  role: string;
}

function assertPayload(action: string, payload: Record<string, unknown>): void {
  switch (action) {
    case 'update_plugin':
    case 'activate_plugin':
    case 'deactivate_plugin':
    case 'enable_plugin_auto_update':
    case 'disable_plugin_auto_update': {
      if (typeof payload.plugin_file !== 'string' || payload.plugin_file.trim() === '') {
        throw ApiError.badRequest('plugin_file is required in payload');
      }
      return;
    }
    case 'bulk_update_plugins': {
      if (!Array.isArray(payload.plugin_files) || payload.plugin_files.length === 0) {
        throw ApiError.badRequest('plugin_files must be a non-empty array');
      }
      for (const f of payload.plugin_files) {
        if (typeof f !== 'string' || !f) {
          throw ApiError.badRequest('plugin_files entries must be non-empty strings');
        }
      }
      return;
    }
    default:
      return;
  }
}

async function ensureActiveSubscription(actor: DispatchActor): Promise<void> {
  if (actor.role === 'admin') return;
  const sub = await prisma.subscription.findUnique({ where: { userId: actor.id } });
  if (!sub) {
    throw ApiError.forbidden('No active subscription — commands are disabled.');
  }
  if (!['active', 'trialing'].includes(sub.status)) {
    throw ApiError.forbidden(`Subscription is ${sub.status} — commands are disabled.`);
  }
}

/* ------------------------------------------------------------------------ */
/*  1. Enqueue — create a pending row and return. Worker dispatches later.   */
/* ------------------------------------------------------------------------ */

export async function enqueueCommand(
  actor: DispatchActor,
  siteId: string,
  input: DispatchInput
): Promise<SiteCommand> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { connection: { select: { connectionEnabled: true } } },
  });
  if (!site) throw ApiError.notFound('Site not found');
  if (actor.role !== 'admin' && site.userId !== actor.id) {
    throw ApiError.notFound('Site not found');
  }
  if (!site.connection) throw ApiError.badRequest('Site has no connection configured');
  if (!site.connection.connectionEnabled) {
    throw ApiError.badRequest('Site connection is disabled');
  }

  assertPayload(input.action, input.payload);
  await ensureActiveSubscription(actor);

  const commandId = `cmd_${randomUUID()}`;
  const row = await prisma.siteCommand.create({
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

  await prisma.siteLog.create({
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
export const dispatchCommand = enqueueCommand;

/* ------------------------------------------------------------------------ */
/*  2. Retry — create a new row linked to the failed parent for audit.       */
/* ------------------------------------------------------------------------ */

export async function retryCommand(
  actor: DispatchActor,
  siteId: string,
  originalCommandRowId: string
): Promise<SiteCommand> {
  const original = await prisma.siteCommand.findUnique({
    where: { id: originalCommandRowId },
    include: { site: { select: { id: true, userId: true } } },
  });
  if (!original) throw ApiError.notFound('Command not found');
  if (original.siteId !== siteId) throw ApiError.notFound('Command not found');
  if (actor.role !== 'admin' && original.site.userId !== actor.id) {
    throw ApiError.notFound('Command not found');
  }
  if (original.status !== 'failed') {
    throw ApiError.badRequest('Only failed commands can be retried');
  }

  await ensureActiveSubscription(actor);

  const rootId = original.parentCommandId ?? original.id;
  const commandId = `cmd_${randomUUID()}`;
  const retryRow = await prisma.siteCommand.create({
    data: {
      siteId: original.siteId,
      userId: actor.id,
      commandId,
      action: original.action,
      payloadJson: original.payloadJson as never,
      status: 'pending',
      attempt: original.attempt + 1,
      parentCommandId: rootId,
    },
  });

  await prisma.siteLog.create({
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

export async function processCommand(commandRowId: string): Promise<void> {
  const command = await prisma.siteCommand.findUnique({
    where: { id: commandRowId },
    include: { site: { include: { connection: true } } },
  });

  if (!command) return;

  if (!command.site || !command.site.connection) {
    await markFailed(command.id, 'invalid_configuration', 'Site has no connection configured');
    return;
  }

  const started = new Date();
  await prisma.siteCommand.update({
    where: { id: command.id },
    data: { startedAt: started },
  });

  const payload = (command.payloadJson ?? {}) as Record<string, unknown>;

  const result = await sendAgentCommand({
    site: { url: command.site.url, uuid: command.site.uuid },
    secret: command.site.connection.secretKeyEncrypted,
    commandId: command.commandId,
    action: command.action,
    payload,
    timeoutMs: config.AGENT_COMMAND_TIMEOUT_MS,
  });

  const agentBody = (result.responseJson ?? null) as
    | { success?: boolean; message?: string; error?: { code?: string; details?: string } }
    | null;
  const agentSucceeded = result.ok && !!agentBody && agentBody.success === true;

  if (agentSucceeded) {
    await prisma.siteCommand.update({
      where: { id: command.id },
      data: {
        status: 'succeeded',
        responseJson: (agentBody ?? undefined) as never,
        errorCode: null,
        errorMessage: null,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });
    await prisma.siteLog.create({
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

  let errorCode: string;
  if (result.httpStatus === 0) {
    errorCode = 'network_error';
  } else if (agentBody?.error?.code) {
    errorCode = agentBody.error.code;
  } else {
    errorCode = `http_${result.httpStatus}`;
  }
  const errorMessage =
    result.errorMessage ??
    agentBody?.error?.details ??
    agentBody?.message ??
    'Agent returned an error';

  await prisma.siteCommand.update({
    where: { id: command.id },
    data: {
      status: 'failed',
      responseJson: (agentBody ?? undefined) as never,
      errorCode,
      errorMessage,
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  });
  await prisma.siteLog.create({
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

async function markFailed(commandRowId: string, errorCode: string, errorMessage: string): Promise<void> {
  await prisma.siteCommand.update({
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
