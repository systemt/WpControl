/**
 * In-memory replay guard for agent X-Request-IDs.
 *
 * TRADEOFF: good enough for a single-process deployment. In a horizontally
 * scaled setup replace the underlying Map with a shared store (Redis, DB) so
 * replay state is consistent across workers — otherwise a replay routed to a
 * different instance will slip through.
 */

const seen = new Map<string, number>();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function evict(now: number): void {
  // Lazy eviction on each access keeps the map bounded by live-request volume.
  for (const [key, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(key);
  }
}

export const replayCache = {
  has(requestId: string): boolean {
    const now = Date.now();
    evict(now);
    const expiresAt = seen.get(requestId);
    return expiresAt !== undefined && expiresAt > now;
  },

  add(requestId: string, ttlMs: number = DEFAULT_TTL_MS): void {
    seen.set(requestId, Date.now() + ttlMs);
  },

  size(): number {
    evict(Date.now());
    return seen.size;
  },

  clear(): void {
    seen.clear();
  },
};
