"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_COMMAND_ROUTE = void 0;
exports.sendAgentCommand = sendAgentCommand;
const crypto_1 = require("crypto");
const hmac_1 = require("./security/hmac");
/**
 * Signed HTTP client for the WP agent's POST /command endpoint.
 *
 * The signature surface is identical to what the agent expects from central:
 *   HMAC_SHA256(body + "|" + timestamp + "|" + path, secret)
 *
 * `path` is the WP REST route (without `/wp-json`) — that's what the plugin
 * signs against internally via `WP_REST_Request::get_route()`.
 */
exports.AGENT_COMMAND_ROUTE = '/digiforce-agent/v1/command';
const AGENT_COMMAND_REST_PATH = '/wp-json/digiforce-agent/v1/command';
/**
 * Dispatch a signed command and return a normalized result. Never throws —
 * network errors / timeouts are surfaced via `ok=false` + `errorMessage` so
 * the caller can persist a failed SiteCommand row and still respond 200.
 */
async function sendAgentCommand(params) {
    const timestampNumber = Math.floor(Date.now() / 1000);
    const timestamp = String(timestampNumber);
    const body = JSON.stringify({
        command_id: params.commandId,
        action: params.action,
        payload: params.payload,
        timestamp: timestampNumber,
    });
    const signature = (0, hmac_1.signAgentRequest)({
        secret: params.secret,
        body,
        timestamp,
        path: exports.AGENT_COMMAND_ROUTE,
    });
    const url = `${params.site.url.replace(/\/$/, '')}${AGENT_COMMAND_REST_PATH}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 45_000);
    const started = Date.now();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Site-UUID': params.site.uuid,
                'X-Timestamp': timestamp,
                'X-Request-ID': (0, crypto_1.randomUUID)(),
                'X-Signature': signature,
            },
            body,
            signal: controller.signal,
        });
        const durationMs = Date.now() - started;
        const text = await response.text();
        let parsed = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        }
        catch {
            parsed = { raw: text };
        }
        return {
            ok: response.ok,
            httpStatus: response.status,
            responseJson: parsed,
            durationMs,
        };
    }
    catch (err) {
        return {
            ok: false,
            httpStatus: 0,
            responseJson: null,
            errorMessage: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - started,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=agent-client.js.map