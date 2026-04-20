# DigiForce Central — v1.1.0

Central management backend for the DigiForce fleet of WordPress sites running the DigiForce WP Agent plugin.

Step 2 adds the first real communication layer between the central and the WordPress agents: registration, heartbeat, and full plugin/theme/core sync — all under HMAC-SHA256 with replay protection. Admin auth, CRUD for sites, and the dashboard from step 1 remain unchanged.

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
