"use strict";
/**
 * In-memory replay guard for agent X-Request-IDs.
 *
 * TRADEOFF: good enough for a single-process deployment. In a horizontally
 * scaled setup replace the underlying Map with a shared store (Redis, DB) so
 * replay state is consistent across workers — otherwise a replay routed to a
 * different instance will slip through.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayCache = void 0;
const seen = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
function evict(now) {
    // Lazy eviction on each access keeps the map bounded by live-request volume.
    for (const [key, expiresAt] of seen) {
        if (expiresAt <= now)
            seen.delete(key);
    }
}
exports.replayCache = {
    has(requestId) {
        const now = Date.now();
        evict(now);
        const expiresAt = seen.get(requestId);
        return expiresAt !== undefined && expiresAt > now;
    },
    add(requestId, ttlMs = DEFAULT_TTL_MS) {
        seen.set(requestId, Date.now() + ttlMs);
    },
    size() {
        evict(Date.now());
        return seen.size;
    },
    clear() {
        seen.clear();
    },
};
//# sourceMappingURL=replay-cache.js.map