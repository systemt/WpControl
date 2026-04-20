=== DigiForce WP Agent ===
Contributors: digiforce
Tags: management, agent, updates, rest-api, hmac, remote-commands
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 8.1
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Central management agent for WordPress: signed REST API, update scanning, and remote plugin management.

== Description ==

DigiForce WP Agent lets a central management system observe and drive a WordPress site over a signed REST API.

Included through step 3:

* Centralised settings store (`wp_options`) with sanitised save flow.
* Admin dashboard under **DigiForce Agent** with live counts, security posture, and a local activity log.
* Custom database table for local logs with severity levels and categories.
* Clean activation / uninstall lifecycle.
* Update scanner that inspects installed plugins, themes, and WordPress core against the wp.org update APIs.
* REST API under the `digiforce-agent/v1` namespace.
* **HMAC-SHA256 signed requests** with 5 minute clock-skew window and `X-Request-ID` replay protection.
* **Remote command execution** for `sync_status`, `scan_updates`, `update_plugin`, `bulk_update_plugins`, `activate_plugin`, `deactivate_plugin`, `enable_plugin_auto_update`, `disable_plugin_auto_update`.

= REST Endpoints =

* `GET  /digiforce-agent/v1/health`  — Public health probe.
* `POST /digiforce-agent/v1/scan`    — Runs an update scan (signed).
* `POST /digiforce-agent/v1/command` — Executes a remote command (signed).

= Request Signing =

Headers:

* `X-Site-UUID`
* `X-Timestamp`   (Unix seconds, must be within 5 minutes of server clock)
* `X-Request-ID`  (unique per call; reused IDs are rejected)
* `X-Signature`   (lowercase hex HMAC-SHA256)

Signature payload:
`<raw request body> + "|" + <timestamp> + "|" + <route>`

Where `<route>` is the full REST path, e.g. `/digiforce-agent/v1/command`.

= What is still stubbed =

The *Sync Status Now* button records a log entry and returns — the sync engine to the central server arrives in a later step.

== Installation ==

1. Upload the `digiforce-wp-agent` folder to `/wp-content/plugins/`.
2. Activate the plugin from the Plugins screen.
3. Open **DigiForce Agent**, configure the central server URL, enable the connection, and copy the Site UUID + secret key into your central console.

== Changelog ==

= 1.1.0 =
* Step 3 — HMAC-signed request validation, replay protection, remote command runner, `POST /command` endpoint, auto-update manager.
* `/scan` now runs through the same signed-security gate as `/command`.
* Admin dashboard surfaces signed-requests and remote-update posture.

= 1.0.0 =
* Step 1 — foundation: settings, admin UI, logging, activation/uninstall.
* Step 2 — update scanner and REST endpoints (`/health`, `/scan`).
