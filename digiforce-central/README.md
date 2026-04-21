# DigiForce Central — v1.7.0

Central management backend for the DigiForce fleet of WordPress sites running the DigiForce WP Agent plugin.

Step 8 adds **bulk plugin updates** (UI only — the `bulk_update_plugins` backend already existed) and **admin-only tenant impersonation** with a visible banner and an `audit_logs` trail. Step 7's DB-backed queue, step 6's command dispatch, step 5's multi-tenant SaaS, and the HMAC agent layer all keep working — no WP-plugin changes required.

## Bulk update UI

On the site-detail page the Plugins table grows a left-hand checkbox column (only for plugins with `hasUpdate=true`). A header bar lets an operator:

- *Select all with updates* — toggles every row in one click (with indeterminate state).
- See a live *"N / N_available selected"* counter.
- Click *Bulk update selected* — disabled until at least one row is checked.

Submission posts `action=bulk_update_plugins` + `plugin_files=<file>` (repeated) to the existing `POST /admin/sites/:id/commands` endpoint. Server-side validation in `commands.service.ts#assertPayload` rejects empty / non-string entries. The command enters the normal queue (`pending → processing → succeeded | failed`) and the agent returns a per-plugin results JSON on the SiteCommand row.

HTML trick: each row's bulk checkbox uses `form="bulk-update-form"` so the per-row *Update / Activate / Deactivate / Auto-update* forms don't end up nested — the checkbox belongs to a sibling form by id.

## Admin impersonation

Admins (role=`admin`) get a new **Users** page at `/admin/users` listing every tenant with plan, site count, last-login. An **Impersonate** button on a non-admin row issues a JWT-signed `dfc_impersonation` cookie (4 h TTL) and redirects to `/dashboard` — where a sticky yellow banner reads **"Impersonating: _Name (email)_"** with a **Stop impersonation** button.

Mechanics:

- `src/middlewares/impersonation.ts#loadImpersonation` runs right after `loadAdminUser`. If the raw session's role is `admin` **and** the impersonation cookie's `adminUserId` matches, it swaps `req.user` to the target and stashes the original admin on `req.originalAdmin`. Any mismatch silently clears the cookie.
- Nested impersonations are rejected — must stop first.
- Impersonating another admin is blocked.
- Every start + stop writes an `AuditLog` row (`actorUserId`, `targetUserId`, `action`, `meta`).
- The **Users** sidebar link hides while impersonating (you're now a user — shouldn't see admin entry points).

Routes:

| Method | Path | Role |
|---|---|---|
| GET  | `/admin/users` | admin |
| POST | `/admin/users/:id/impersonate` | admin |
| POST | `/stop-impersonation` | any authenticated (clears cookie + audits) |

## Schema addition

A new `audit_logs` table — not site-scoped. Apply with `npm run prisma:migrate -- --name audit_log`. Future admin actions will also land there.

## Background command queue

| Knob | Env | Default |
|---|---|---|
| Enable in-process worker | `COMMAND_WORKER_ENABLED` | `true` |
| Poll interval | `COMMAND_WORKER_POLL_MS` | `2000` |
| Max commands per tick | `COMMAND_WORKER_BATCH_SIZE` | `5` |
| Stale-lock recovery | `COMMAND_WORKER_STALE_LOCK_MS` | `300000` |
| Per-command agent timeout | `AGENT_COMMAND_TIMEOUT_MS` | `45000` |

**Status flow**: `pending → processing → succeeded | failed`. If a worker dies mid-dispatch, the row stays `processing` with a `lockedAt` timestamp; the next tick's `recoverStaleLocks()` flips rows older than `COMMAND_WORKER_STALE_LOCK_MS` back to `pending` for another attempt.

**Atomic claim** — `src/modules/commands/commands.worker.ts#claimNext` uses a single statement:

```sql
UPDATE site_commands
SET status = 'processing', locked_at = NOW(), locked_by = $1
WHERE id = (
  SELECT id FROM site_commands
  WHERE status = 'pending'
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING id
```

Safe to run multiple workers (e.g. if you split into a separate worker dyno later) — `SKIP LOCKED` prevents double-claims without blocking.

## Manual retry

New admin-UI row action on the site-detail commands table: the **Retry** button appears only when `status='failed'`. It creates a new `SiteCommand` row with:

- `attempt = original.attempt + 1`
- `parentCommandId = original.parentCommandId ?? original.id` (points at the root)
- `payloadJson` copied from the original
- `status = 'pending'`

The original row stays untouched so its `responseJson` / `errorCode` / `finishedAt` remain auditable. The table shows "retry of prior attempt" under the command id so you can walk the chain.

New routes:

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/sites/:id/commands/:commandId/retry` | JWT |
| POST | `/admin/sites/:id/commands/:commandId/retry`  | cookie |

Both return HTTP `202 Accepted` with the new retry row (`status=pending`).

## Migration from v1.3.0

The schema moves from the old `admin_users` table to a unified `users` table and introduces `plans`, `subscriptions`, and a `user_id` column on `sites` + `site_commands`.

```bash
# 1. Pull the new code, install dependencies
npm install

# 2. Generate and apply the migration
npm run prisma:migrate -- --name multi_tenant_saas

# 3. Re-seed to create the three plans and ensure the super-admin user exists
npm run seed
```

**Data backfill**: the seed script also reassigns any site with an empty `userId` to the super-admin account so the schema's `NOT NULL` constraint is satisfied. In production, run the migration in two passes if you have many legacy sites:

```sql
-- Phase 1 (after `prisma migrate` creates the nullable column manually, or against a dev DB):
UPDATE sites SET user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1) WHERE user_id IS NULL;
-- Phase 2 (after the UPDATE completes, Prisma's generated migration already sets NOT NULL):
```

## Stack

Node.js 18+ · TypeScript · Express · PostgreSQL · Prisma · JWT · bcryptjs · Zod · Helmet · CORS · EJS · cookie-parser · (optional) Stripe

## Stack

Node.js 18+ · TypeScript · Express · PostgreSQL · Prisma · JWT · bcrypt · Zod · Helmet · CORS

## Prerequisites

- Node.js ≥ 18.17
- PostgreSQL ≥ 13 reachable via `DATABASE_URL`

## Install

```bash
npm install
cp .env.example .env
# edit .env — set DATABASE_URL and JWT_SECRET
```

## Database

```bash
npm run prisma:migrate         # applies schema (dev) — will prompt for a migration name
# or in production: npm run prisma:deploy
npm run seed                   # creates the default admin user
```

The step-2 migration adds `site_plugin_snapshots`, `site_theme_snapshots`, and `site_core_snapshots` tables and relations. Suggested migration name: `add_site_snapshots`.

## Run

```bash
npm run dev                    # development with tsx watch
# or
npm run build && npm start
```

## Default admin

- Email: `admin@digiforce.local`
- Password: `Admin123!`
- Role: `super_admin`

**Change the password immediately after first login.**

## Billing

Plans live in the `plans` table. The seed creates:

| Slug     | Name    | Max sites | Price |
|----------|---------|-----------|-------|
| starter  | Starter | 5         | $19 / mo |
| pro      | Pro     | 20        | $49 / mo |
| agency   | Agency  | unlimited | $149 / mo |

**Providers** — `src/lib/billing/` ships two implementations behind one `BillingProvider` interface:

- `MockBillingProvider` (default) — no external calls, plans flip immediately. Good for dev / Render staging.
- `StripeBillingProvider` — stub that throws until you install the `stripe` SDK and fill in the real calls. Toggle via `BILLING_PROVIDER=stripe` + `STRIPE_SECRET_KEY`.

Endpoints:

- `GET  /api/v1/plans` (public) — lists public plans.
- `GET  /api/v1/billing/me` (auth) — current user's subscription + site usage.
- `POST /api/v1/billing/checkout` — starts a hosted-checkout flow (mock returns an inline URL that finalizes the plan change).
- `POST /api/v1/billing/change-plan` — immediately switch (used by both mock and admin tooling).
- `POST /api/v1/billing/cancel` — cancel subscription.

UI at `/billing` covers the same flows with forms.

## Command dispatch

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/sites/:id/commands` | JWT | Dispatch a signed command to the agent |
| GET  | `/api/v1/sites/:id/commands` | JWT | List recent commands for a site |
| POST | `/admin/sites/:id/commands`  | cookie | Same dispatch, but driven by the EJS action buttons |

**Request body** (dispatch):
```json
{ "action": "update_plugin", "payload": { "plugin_file": "woocommerce/woocommerce.php" } }
```

**Supported actions**: `sync_status`, `scan_updates`, `update_plugin`, `bulk_update_plugins`, `activate_plugin`, `deactivate_plugin`, `enable_plugin_auto_update`, `disable_plugin_auto_update`.

**What happens under the hood** — `src/modules/commands/commands.service.ts#dispatchCommand`:

1. Resolve site + connection, reject cross-tenant access with 404 (not 403).
2. Validate per-action payload (`plugin_file` / `plugin_files[]`).
3. Check subscription is `active`/`trialing` (admins bypass).
4. Insert `SiteCommand { status: 'pending' }`.
5. Flip to `'sent'` + `startedAt`.
6. POST HMAC-signed payload to `${site.url}/wp-json/digiforce-agent/v1/command` with headers `X-Site-UUID`, `X-Timestamp`, `X-Request-ID`, `X-Signature`. Signature path is `/digiforce-agent/v1/command` to match `WP_REST_Request::get_route()` on the agent side.
7. Flip to `'succeeded'` / `'failed'`, capture `responseJson`, `errorCode`, `errorMessage`, `finishedAt`.
8. Write a `SiteLog` row under `category='command'`.

The response is always HTTP 200; the JSON body's `success` mirrors the agent outcome so clients read a single field.

**curl example**:

```bash
TOKEN=$(curl -sS -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@digiforce.local","password":"Admin123!"}' | jq -r .data.token)

curl -sS -X POST http://localhost:4000/api/v1/sites/SITE_ID_HERE/commands \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"action":"sync_status","payload":{}}' | jq
```

Failure modes surface via `status='failed'` + one of:
- `network_error` — agent unreachable / DNS / timeout.
- `http_<code>` — HTTP error without a structured body.
- whatever error code the agent returns (`invalid_signature`, `plugin_not_found`, `plugin_update_failed`, …).

## Plan-limit enforcement

`src/middlewares/plan-limits.ts` is mounted in front of `POST /api/v1/sites` and the admin-UI `POST /sites`. Before creating a site we check:

1. There is a subscription row for the user.
2. Status is `active` or `trialing` (a stale trial is rejected automatically).
3. Site count under `user.id` is below `plan.maxSites` (or unlimited if `maxSites` is null).

Admins (`role='admin'`) skip the quota entirely — they're tenant operators, not consumers.

## Admin console (server-rendered)

Open `http://localhost:4000/login` and sign in with the seeded credentials. After login a `dfc_admin_token` httpOnly cookie is set (JWT, `sameSite=lax`, `secure` in production) and you're redirected to `/admin`.

| Path | Purpose |
|---|---|
| `GET  /login`              | Sign-in page |
| `POST /login`              | Form submission — sets the admin cookie |
| `POST /logout`             | Clears the cookie, redirects to `/login` |
| `GET  /admin`              | Dashboard — counters + recent sites + recent logs |
| `GET  /admin/sites`        | Searchable sites table (search, status + environment filters) |
| `GET  /admin/sites/new`    | New-site form |
| `POST /admin/sites`        | Create site — redirects to detail with a one-time secret reveal |
| `GET  /admin/sites/:id`    | Site detail — identity, connection, snapshots, commands, recent activity |
| `GET  /admin/logs`         | Logs table with level / category / site filters |

Static admin assets (CSS, future icons) are served from `/public/*`.

**Default admin** — same as the JWT API:
- Email: `admin@digiforce.local`
- Password: `Admin123!`

## API surface

### Admin (JWT-protected)

| Method | Path                              | Purpose                                        |
|--------|-----------------------------------|------------------------------------------------|
| GET    | `/api/v1/system/health`           | Health + version                               |
| POST   | `/api/v1/auth/login`              | Admin login                                    |
| POST   | `/api/v1/auth/logout`             | Stateless logout stub                          |
| GET    | `/api/v1/auth/me`                 | Current admin profile                          |
| GET    | `/api/v1/admin-users`             | List admins                                    |
| GET    | `/api/v1/admin-users/me`          | Current admin profile                          |
| GET    | `/api/v1/dashboard/summary`       | Fleet counters (+ `sitesWithUpdates`)          |
| GET    | `/api/v1/sites`                   | List sites (+ snapshot counts, core hint)      |
| GET    | `/api/v1/sites/:id`               | Site detail (+ plugin/theme counts, core)      |
| POST   | `/api/v1/sites`                   | Create site (+ secret returned once)           |
| PUT    | `/api/v1/sites/:id`               | Update site                                    |
| DELETE | `/api/v1/sites/:id`               | Delete site                                    |
| GET    | `/api/v1/sites/:id/plugins`       | Latest plugin snapshots                        |
| GET    | `/api/v1/sites/:id/themes`        | Latest theme snapshots                         |
| GET    | `/api/v1/sites/:id/core`          | Latest core snapshot                           |

### Agent (HMAC-signed)

| Method | Path                        | Purpose                       |
|--------|-----------------------------|-------------------------------|
| POST   | `/api/v1/agent/register`    | Register a site / refresh id  |
| POST   | `/api/v1/agent/heartbeat`   | Keepalive + light status      |
| POST   | `/api/v1/agent/sync`        | Full plugin/theme/core sync   |

Agent requests must include:

- `X-Site-UUID`
- `X-Timestamp`   (Unix seconds, within 5 minutes of server clock)
- `X-Request-ID`  (unique per call, used for replay protection)
- `X-Signature`   (lowercase hex `HMAC_SHA256(body + "|" + timestamp + "|" + path, secretKey)`)

Where `path` is the exact request path the agent is hitting on the central — e.g. `/api/v1/agent/register`. Replay cache holds request IDs for 10 minutes in-process; swap for Redis when scaling horizontally.

## Response shape

Success:
```json
{ "success": true, "data": { /* ... */ } }
```

Failure:
```json
{ "success": false, "error": { "code": "unauthorized", "message": "Invalid signature" } }
```

## Smoke tests (curl)

1. **Provision a site as admin** and capture the secret that's returned once:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@digiforce.local","password":"Admin123!"}' | jq -r '.data.token')

curl -s -X POST http://localhost:4000/api/v1/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Acme","url":"https://acme.example","environment":"production"}' \
  | tee /tmp/site.json | jq

SITE_UUID=$(jq -r '.data.uuid'      /tmp/site.json)
SECRET=$(jq -r '.data.secretKey'    /tmp/site.json)
```

2. **Register the agent** (computes HMAC with openssl):

```bash
CENTRAL=http://localhost:4000
PATH_R=/api/v1/agent/register
TS=$(date +%s)
REQ_ID=$(uuidgen)
BODY=$(jq -c --arg uuid "$SITE_UUID" '{
  site_uuid:$uuid,
  site_url:"https://acme.example",
  site_name:"Acme",
  admin_email:"admin@acme.example",
  wordpress_version:"6.8.1",
  php_version:"8.2.15",
  plugin_version:"1.2.0",
  environment:"production"
}' <<<'{}')
SIG=$(printf '%s' "${BODY}|${TS}|${PATH_R}" | openssl dgst -sha256 -hmac "$SECRET" -r | awk '{print $1}')

curl -s -X POST "${CENTRAL}${PATH_R}" \
  -H "Content-Type: application/json" \
  -H "X-Site-UUID: $SITE_UUID" \
  -H "X-Timestamp: $TS" \
  -H "X-Request-ID: $REQ_ID" \
  -H "X-Signature: $SIG" \
  --data-raw "$BODY" | jq
```

3. **Heartbeat**:

```bash
PATH_R=/api/v1/agent/heartbeat
TS=$(date +%s)
REQ_ID=$(uuidgen)
BODY=$(jq -c --arg uuid "$SITE_UUID" '{
  site_uuid:$uuid,
  plugin_version:"1.2.0",
  wordpress_version:"6.8.1",
  php_version:"8.2.15",
  summary:{plugins_total:28,plugins_need_update:4,themes_need_update:1,core_need_update:false}
}' <<<'{}')
SIG=$(printf '%s' "${BODY}|${TS}|${PATH_R}" | openssl dgst -sha256 -hmac "$SECRET" -r | awk '{print $1}')

curl -s -X POST "${CENTRAL}${PATH_R}" \
  -H "Content-Type: application/json" \
  -H "X-Site-UUID: $SITE_UUID" \
  -H "X-Timestamp: $TS" \
  -H "X-Request-ID: $REQ_ID" \
  -H "X-Signature: $SIG" \
  --data-raw "$BODY" | jq
```

4. **Full sync**:

```bash
PATH_R=/api/v1/agent/sync
TS=$(date +%s)
REQ_ID=$(uuidgen)
BODY=$(jq -c --arg uuid "$SITE_UUID" '{
  site_uuid:$uuid,
  core:{current_version:"6.8.1",latest_version:"6.8.1",has_update:false,update_type:null},
  themes:[{stylesheet:"astra",template:"astra",name:"Astra",version_installed:"4.8.1",version_available:"4.8.2",has_update:true,auto_update_enabled:false,is_active:true}],
  plugins:[{plugin_file:"woocommerce/woocommerce.php",slug:"woocommerce",name:"WooCommerce",version_installed:"9.0.0",version_available:"9.1.0",has_update:true,is_active:true,auto_update_enabled:false,author:"Automattic",requires_wp:"6.7",requires_php:"7.4"}]
}' <<<'{}')
SIG=$(printf '%s' "${BODY}|${TS}|${PATH_R}" | openssl dgst -sha256 -hmac "$SECRET" -r | awk '{print $1}')

curl -s -X POST "${CENTRAL}${PATH_R}" \
  -H "Content-Type: application/json" \
  -H "X-Site-UUID: $SITE_UUID" \
  -H "X-Timestamp: $TS" \
  -H "X-Request-ID: $REQ_ID" \
  -H "X-Signature: $SIG" \
  --data-raw "$BODY" | jq
```

5. **Verify** the persisted snapshot via admin endpoints:

```bash
curl -s -H "Authorization: Bearer $TOKEN" "${CENTRAL}/api/v1/sites" | jq
curl -s -H "Authorization: Bearer $TOKEN" "${CENTRAL}/api/v1/dashboard/summary" | jq
```

## Project layout

```
prisma/
  schema.prisma
  seed.ts
src/
  app.ts
  server.ts
  config/
  lib/
    jwt.ts
    prisma.ts
    security/
      hmac.ts
      replay-cache.ts
  middlewares/
    agent-signature.ts
    auth.ts
    error-handler.ts
    not-found.ts
    request-logger.ts
    validate.ts
  utils/
  modules/
    admin-users/
    agent/
    auth/
    dashboard/
    sites/
    system/
```
