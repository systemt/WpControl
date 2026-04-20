=== DigiForce WP Agent ===
Contributors: digiforce
Tags: management, updates, remote, api, agent, hmac
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect a WordPress site to a central DigiForce management system and accept signed remote commands for plugin management.

== Description ==

DigiForce WP Agent exposes a secure, signed REST API so a central management system can:

* Inspect WordPress core, plugin, and theme update status
* Trigger plugin updates (single and bulk)
* Activate or deactivate plugins
* Toggle plugin auto-updates

All write requests are signed with HMAC-SHA256 and protected against replay attacks via a sliding timestamp window and request-id de-duplication.

= REST Endpoints =

Namespace: `digiforce-agent/v1`

* `GET  /health`   — Health check (unsigned).
* `POST /scan`     — Force a fresh update scan (signed).
* `POST /command`  — Execute a remote command (signed).

= Supported Commands =

* `sync_status`
* `scan_updates`
* `update_plugin`
* `bulk_update_plugins`
* `activate_plugin`
* `deactivate_plugin`
* `enable_plugin_auto_update`
* `disable_plugin_auto_update`

= Request Signing =

Every signed request must include these headers:

* `X-Site-UUID`
* `X-Timestamp`  (Unix seconds, must be within 5 minutes of server clock)
* `X-Request-ID` (unique per request, used for replay protection)
* `X-Signature`  (lowercase hex HMAC-SHA256)

Signature payload:
`<raw request body> + "|" + <timestamp> + "|" + <route>`

Where `<route>` is the full REST path, e.g. `/digiforce-agent/v1/command`.

== Installation ==

1. Upload the `digiforce-wp-agent` folder to `/wp-content/plugins/`.
2. Activate the plugin through the "Plugins" menu in WordPress.
3. Go to **DigiForce Agent** in the admin menu.
4. Configure the central server URL, enable the connection, and copy the Site UUID and Secret Key into the DigiForce central console.

== Frequently Asked Questions ==

= Is the secret key ever sent over the network? =

No. Only HMAC signatures derived from the secret are transmitted. The secret lives in the WordPress options table.

= What happens if I rotate the secret? =

Requests signed with the old secret stop validating immediately. Update the central server with the new secret before issuing more commands.

== Changelog ==

= 1.0.0 =
* Initial MVP release.
* Signed REST API (`/health`, `/scan`, `/command`).
* Plugin update, bulk update, activation, deactivation, auto-update toggles.
* Local log table with retention.
* Admin dashboard with manual scan/sync buttons.
