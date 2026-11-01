# collate

collation system for election data

## Database setup

The app talks to a cloud-hosted PostgreSQL instance through TypeORM. Schema changes only ever happen through migrations (`synchronize` is always off).

1. Get your connection string (PostgreSQL URI) from your hosting provider.
2. Copy `.env.example` to `.env` and fill it in:

   ```sh
   cp .env.example .env
   ```

   - `DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME`
   - `DATABASE_SSL=true` — required by most cloud providers. Set `false` for a plain local connection. (If your provider gives you a CA certificate, wire it into the `ssl` setting in `lib/db/data-source.ts`.)

   ⚠️ Never commit `.env`. It is already git-ignored.

3. Run the migrations against the database:

   ```sh
   npm run db:migrate
   ```

4. Start the app (`npm run dev`) and check the health endpoint at [`/api/health`](http://localhost:3000/api/health) — it should return `{"ok":true}`.

### Additional migration commands

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Runs pending migrations |
| `npm run db:migrate:revert` | Reverts the last migration |
| `npm run db:migrate:generate -- lib/db/migrations/AddFeature` | Generates a migration from entity changes |
| `npm run db:migrate:create -- lib/db/migrations/AddFeature` | Creates an empty migration |

> If your provider hands out two connection strings (e.g. Supabase, Neon), the **pooled** one is fine for the app runtime, but migrations usually need the **direct** (non-pooled) connection string — DDL contracts/connection timeouts on poolers can make `db:migrate` fail unpredictably.

## Demo data

The project includes a deterministic demo data generator that creates realistic operational data for walkthroughs and demos without using any real personal information.

The seed is intentionally isolated from production and refuses to run unless:

- `NODE_ENV` is not `production`
- `ALLOW_DEMO_SEED=true` is set
- you confirm the target database is a development or demo database before executing it

The demo data creates fake people, fake phone numbers, fake audit IPs and fake candidate access tokens. All demo emails end in `@demo.collate.test`, all demo phone numbers begin with `+234000000`, and all demo audit logs use `203.0.113.*` addresses.

Use these commands:

```sh
npm run db:seed:demo
npm run db:seed:demo:reset
npm run db:seed:demo:fresh
```

The generator stores the plain access tokens for active access links in `.demo-seed-output.json` (git-ignored). The file is used only by the demo flow; plain tokens are never printed to the console or stored in the database.

> This demo data must only be used on a development or demo database and never against a live production database.

## Backend API

These server-side APIs do not depend on frontend wiring. Geography and coverage routes, plus the permissions endpoint, require a valid session cookie; OTP request and verification establish that session. Geography and coverage reads are restricted to the caller's membership scopes (party and admin memberships have global coverage access).

Interactive Swagger UI is available at [`/api/docs`](http://localhost:3000/api/docs); the OpenAPI specification is served from [`/openapi.yaml`](http://localhost:3000/openapi.yaml). Sign in in the same browser session before trying protected operations. The docs UI loads its Swagger UI assets from a pinned CDN release.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/otp/request` | Request a sign-in code |
| `POST /api/auth/otp/verify` | Verify a code and create a session |
| `GET /api/auth/session` | Check the current session |
| `POST /api/auth/logout` | Revoke the current session |
| `GET /api/auth/permissions` | Read role and permission flags |
| `GET /api/geography/states` | List accessible states and coverage counts |
| `GET /api/geography/states/{stateId}` | Read an accessible state's coverage |
| `GET /api/geography/states/{stateId}/lgas` | List accessible LGAs in a state |
| `GET /api/geography/lgas/{lgaId}/wards` | List accessible wards in an LGA |
| `GET /api/geography/wards/{wardId}/polling-units` | List accessible polling units and agent details |
| `GET /api/coverage/summary` | Read coverage totals |
| `GET /api/coverage/gaps` | List polling units without an official agent |
| `POST /api/coverage/assignments` | Create an agent assignment |
| `DELETE /api/coverage/assignments/{assignmentId}` | Remove an assignment |

Coverage reads accept optional `stateId`, `lgaId`, `wardId`, and `politicalUnitId` filters. The gaps endpoint also accepts `limit` (1–500, default 100) and `offset` (default 0).

Create an assignment with `personId`, `pollingUnitId`, `agentKind`, `slotNumber`, and exactly one of `ownerGroupId` or `ownerCandidateId`. Official assignments use slot `0`; extra assignments use a positive slot number. Admins can manage any owner; other callers must manage the selected party/campaign group or their own candidate record, and must have scope access to the polling unit. Creates and removals are recorded in `audit_log`.

## Worker

A separate Node process (`worker/`) consumes jobs from a pg-boss queue backed by the same Postgres database. It shares the DB with the app, takes no HTTP traffic, and opens no port. It will later run broadcasts, imports and coverage refresh jobs; only a `test-job` smoke-test queue exists right now.

Queue names and default retry options live in `lib/queue/names.ts`; the app enqueues through `lib/queue/index.ts` (server-only). Both sides never import files marked `server-only` inside the worker.

Run it (keep the app running in another terminal for enqueueing):

```sh
npm run worker      # runs worker/index.ts via tsx (loads .env itself)
npm run worker:dev  # same, with watch/restart on file change
```

Smoke-test it end to end:

1. Start the app (`npm run dev`) and `npm run worker` in separate terminals.
2. Enqueue jobs through the dev-only endpoint:

   ```sh
   curl -X POST http://localhost:3000/api/dev/queue-test \
     -H "Content-Type: application/json" \
     -d '{"count": 1}'
   ```

   - `count` (default 1, max 50) — number of test jobs to enqueue.
   - `fail: true` in the JSON body makes each job throw: it then retries 5 times with a growing (backoff) delay and finally ends up marked `failed`.
3. Watch the worker log — each job id is printed exactly once, even across multiple workers running at the same time.
4. Open <http://localhost:3000/api/dev/queue-test> in a browser (`GET`): it reports per-state job counts (`deferred`/`queued`/`ready`/`active`/`failed`) for every queue, freshly counted.
5. Stop the worker with `Ctrl+C` (or `SIGTERM`); it drains in-flight jobs and exits with code 0.

> The endpoint returns 404 in production (`NODE_ENV=production`) and exposes no auth — it must stay dev-only.

> Pool note: one worker instance uses at most 3 Postgres connections (`max: 3`), but pg-boss also runs background maintenance queries, so connection budgets matter: if your provider gives a **pooled** and a **direct** connection string (PgBouncer in transaction mode), the worker may need the **direct** one too (LISTEN/NOTIFY and prepared statements don't always behave behind transaction-mode poolers). Also note cloud providers often drop idle TLS connections; pg-boss logs reconnects on its `error` event and keeps polling — a burst of `ECONNRESET`/timeout errors after idle periods is recoverable noise, not a crash.

## Policy and agents API

Every new API read must go through `lib/policy`; route handlers must not import `typeorm`, `pg`, or `lib/db` or query tables directly. The policy layer combines polling-unit scope with owner-group visibility before returning data.

`GET /api/agents` returns:

```json
{
  "items": [
    {
      "assignmentId": "uuid",
      "agentKind": "official",
      "slotNumber": 0,
      "personId": "uuid",
      "fullName": "Agent name",
      "maskedPhone": "+234******1234",
      "pollingUnit": {
        "id": 1,
        "inecPollingUnitCode": "code",
        "name": "Polling unit",
        "wardName": "Ward",
        "lgaName": "LGA",
        "stateName": "State"
      },
      "owner": {
        "type": "group",
        "id": 1,
        "displayName": "Group"
      }
    }
  ],
  "nextCursor": null
}
```

Supported query filters are `stateId`, `lgaId`, `wardId`, `politicalUnitId`, `ownerGroupId`, `ownerCandidateId`, and `agentKind`. Non-admin candidates cannot use `lgaId`. `cursor` continues keyset pagination; `limit` defaults to 50 and is capped at 100. Every page read is audited. Phone numbers are masked, and email addresses and voter card numbers are never returned.
