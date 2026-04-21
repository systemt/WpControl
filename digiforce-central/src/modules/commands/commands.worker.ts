import { hostname } from 'os';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { processCommand } from './commands.service';

/**
 * DB-backed command queue worker.
 *
 * Runs in-process via `setInterval` so Render single-dyno deployments don't
 * need a separate worker process. Atomic claim uses PostgreSQL's
 * `FOR UPDATE SKIP LOCKED` so multiple instances (or a dyno + a manual admin
 * script) can coexist without double-processing.
 *
 * Safe to start/stop repeatedly — `startCommandQueueWorker()` is idempotent.
 */

const WORKER_ID = `${hostname()}:${process.pid}`;

let intervalHandle: NodeJS.Timeout | null = null;
let ticking = false;
let stopping = false;

function log(level: 'info' | 'warn' | 'error', message: string, ctx?: Record<string, unknown>) {
  const prefix = `[queue ${WORKER_ID}]`;
  const line = ctx ? `${prefix} ${message} ${JSON.stringify(ctx)}` : `${prefix} ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Recover commands whose `processing` lock is older than the configured stale
 * window — a prior worker crashed mid-dispatch. Returns them to `pending` so
 * they can be claimed again.
 */
async function recoverStaleLocks(): Promise<void> {
  const cutoff = new Date(Date.now() - config.COMMAND_WORKER_STALE_LOCK_MS);
  const { count } = await prisma.siteCommand.updateMany({
    where: { status: 'processing', lockedAt: { lt: cutoff } },
    data: { status: 'pending', lockedAt: null, lockedBy: null },
  });
  if (count > 0) {
    log('warn', 'recovered stale locks', { count });
  }
}

/**
 * Atomically claim the oldest pending command. Returns the claimed row id, or
 * null if nothing was available. Uses `FOR UPDATE SKIP LOCKED` so concurrent
 * workers never block each other.
 */
async function claimNext(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE site_commands
    SET status = 'processing', locked_at = NOW(), locked_by = ${WORKER_ID}
    WHERE id = (
      SELECT id FROM site_commands
      WHERE status = 'pending'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

async function tick(): Promise<void> {
  if (ticking || stopping) return;
  ticking = true;
  try {
    await recoverStaleLocks();
    for (let i = 0; i < config.COMMAND_WORKER_BATCH_SIZE; i++) {
      if (stopping) break;
      const id = await claimNext();
      if (!id) break;
      log('info', 'processing command', { id });
      try {
        await processCommand(id);
      } catch (err) {
        log('error', 'processCommand threw', {
          id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Worst case: the row stays `processing` until stale-lock recovery
        // flips it back to `pending` on a later tick. processCommand is
        // explicitly designed not to throw, so reaching this catch is a bug.
      }
    }
  } catch (err) {
    log('error', 'tick error', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    ticking = false;
  }
}

export interface WorkerHandle {
  stop(): Promise<void>;
  tickNow(): Promise<void>; // useful from tests / manual admin ops
}

export function startCommandQueueWorker(): WorkerHandle {
  if (intervalHandle) return buildHandle();

  if (!config.COMMAND_WORKER_ENABLED) {
    log('info', 'worker disabled via COMMAND_WORKER_ENABLED=false');
    return buildHandle();
  }

  log('info', 'worker starting', {
    pollMs: config.COMMAND_WORKER_POLL_MS,
    batch: config.COMMAND_WORKER_BATCH_SIZE,
    staleLockMs: config.COMMAND_WORKER_STALE_LOCK_MS,
  });

  intervalHandle = setInterval(() => {
    void tick();
  }, config.COMMAND_WORKER_POLL_MS);
  // Don't keep the event loop alive just for the poll timer.
  intervalHandle.unref?.();

  // Fire immediately so the first job doesn't wait a full poll interval.
  void tick();

  return buildHandle();
}

function buildHandle(): WorkerHandle {
  return {
    async stop() {
      stopping = true;
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      // Let any in-flight tick finish before we resolve.
      for (let i = 0; i < 50 && ticking; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      stopping = false;
      log('info', 'worker stopped');
    },
    async tickNow() {
      await tick();
    },
  };
}
