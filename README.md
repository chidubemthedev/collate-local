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

## Telegram

Create a bot with [BotFather](https://t.me/BotFather), add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and a 16–256 character `TELEGRAM_WEBHOOK_SECRET` to `.env`, then run `npm run telegram:check` to verify the configured bot. Webhook setup and deletion are available through `npm run telegram:webhook:set -- https://your-host/path` and `npm run telegram:webhook:delete`.

## Backend API

The REST API is available independently of frontend pages. Its machine-readable contract is [`/api/openapi`](http://localhost:3000/api/openapi), and the interactive Swagger UI is at [`/api/docs`](http://localhost:3000/api/docs). The Swagger UI loads its assets from a pinned CDN release. See [Backend system design](./docs/backend-system-design.md) for architecture and request-flow diagrams.

Use the URL of the running deployment as the base URL. Examples below use `http://localhost:3000`. Endpoints that change or expose protected data require the session cookie issued by OTP verification, except for the health check and OTP request/verify endpoints.

### Response conventions

JSON API responses use a common envelope:

```json
{ "status": "success", "data": {} }
```

Paginated APIs can also return `meta`. Errors use:

```json
{
  "status": "error",
  "error": {
    "code": "validation_failed",
    "message": "Invalid request",
    "fields": { "limit": "must_be_at_most_100" }
  }
}
```

`fields` is optional and is returned for some validation errors. The common HTTP statuses are `400` (invalid input), `401` (missing or invalid session), `403` (authenticated but unauthorized, or invalid origin), `404` (missing resource or outside visible scope), `409` (conflict), `429` (rate limit), and `500` (unexpected server/database failure). Do not rely on internal database error details being returned to clients.

### Endpoint index

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | None | Check that the application can reach PostgreSQL |
| `POST /api/auth/otp/request` | None | Request an email sign-in code |
| `POST /api/auth/otp/verify` | None | Verify a code and create a session |
| `GET /api/auth/session` | Session cookie, if present | Report the current session and person |
| `POST /api/auth/logout` | Session cookie, if present | Delete the current session and clear its cookie |
| `GET /api/auth/permissions` | Required | Return the caller's role names and permission flags |
| `GET /api/agents` | Required | List policy-visible agent assignments |
| `GET /api/geography/states` | Required | List accessible states and counts |
| `GET /api/geography/states/{stateId}` | Required | Read one accessible state's counts |
| `GET /api/geography/states/{stateId}/lgas` | Required | List accessible LGAs and counts within a state |
| `GET /api/geography/lgas/{lgaId}/wards` | Required | List accessible wards and counts within an LGA |
| `GET /api/geography/wards/{wardId}/polling-units` | Required | List accessible polling units and agent details |
| `GET /api/coverage/summary` | Required | Summarize coverage in an accessible area |
| `GET /api/coverage/gaps` | Required | List polling units with no official agent |
| `POST /api/coverage/assignments` | Required, same-origin | Create an agent assignment |
| `DELETE /api/coverage/assignments/{assignmentId}` | Required, same-origin | Delete an agent assignment |
| `GET, POST /api/dev/queue-test` | None; development only | Inspect or enqueue test jobs; returns 404 in production |
| `GET /api/openapi` | None | Serve the OpenAPI YAML |
| `GET /api/docs` | None | Serve Swagger UI |

### Authentication and sessions

Authentication is passwordless. The person must already exist and be eligible: they must have a `membership` or a `candidate` row. OTPs are six digits and expire after 10 minutes. The OTP itself is not stored in the database; only an HMAC hash is stored. Requests are limited to 5 per hour per normalized email and 20 per hour per IP. Verification attempts are limited to 10 per IP per 15 minutes.

1. Request an OTP:

   ```http
   POST /api/auth/otp/request
   Content-Type: application/json

   { "email": "person@example.com" }
   ```

   A successful request returns `{ "status": "success", "data": { "ok": true } }`. Unknown/ineligible emails return `404`. The code is delivered through the configured OTP sender.

2. Verify it:

   ```http
   POST /api/auth/otp/verify
   Content-Type: application/json

   { "email": "person@example.com", "code": "123456" }
   ```

   On success, the response sets the session cookie. The browser sends this cookie automatically on same-origin requests. It is `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` in production. Its name is `collate_session` outside production and `__Host-collate_session` in production.

3. Check or end the session:

   - `GET /api/auth/session` returns `data.authenticated: false` if there is no valid session; otherwise it returns the signed-in person. This is a status endpoint, not a way to extend the absolute session lifetime.
   - `POST /api/auth/logout` deletes the session row and expires the cookie.

Sessions have a 12-hour absolute lifetime and a 2-hour idle timeout. Protected requests validate the token by hashing it and looking up `auth_session`; raw session tokens are not stored in the database. `GET /api/auth/permissions` returns `isAdmin`, `canManageCoverage`, `canBroadcast`, and role names. Currently `canBroadcast` mirrors `canManageCoverage`; it does not mean a broadcast API is implemented.

For local development, `OTP_DELIVERY=console` logs the code to the server terminal and is forbidden in production. When `OTP_DELIVERY=brevo`, configure `BREVO_API_KEY` and optionally `BREVO_FROM_EMAIL` and `BREVO_FROM_NAME`. `AUTH_SECRET` must contain at least 32 characters. See `.env.example`.

> The OTP routes do not implement an explicit Origin check. Assignment mutation routes do require an `Origin` matching the request URL's origin.

### Geography API

Geography is a hierarchy: **state → LGA → ward → polling unit**. IDs in paths are database IDs (positive integers), not INEC codes. Results are filtered by the caller's membership scope. Admin and party group memberships currently receive global geography/coverage scope; other memberships are limited by their `membership_scope_unit` rows.

| Endpoint | Returns |
| --- | --- |
| `GET /api/geography/states` | State identifiers/codes/names and totals for polling units, GPS points, official-agent coverage, extra agents, LGAs, and wards |
| `GET /api/geography/states/{stateId}` | The same summary for one state; an unavailable state returns `404` |
| `GET /api/geography/states/{stateId}/lgas` | Accessible LGAs in the state, each with its polling-unit, GPS, coverage, extra-agent, and ward counts |
| `GET /api/geography/lgas/{lgaId}/wards` | Accessible wards in the LGA, with polling-unit, GPS, coverage, and extra-agent counts |
| `GET /api/geography/wards/{wardId}/polling-units` | Accessible polling units in the ward, with INEC codes, GPS status, and official/extra agent details |

Coverage figures in these responses are calculated from the geography tables and `agent_assignment`. `coveredPUs` counts polling units with an official assignment; extra-agent presence alone does not count as official coverage. Phone values exposed with agent details are selected from `phone_number`; do not treat these endpoints as a phone-number export.

### Agents API

`GET /api/agents` returns assignments, not every row in `person`. A person appears as an agent when they have an `agent_assignment`. The response joins the person, assignment, polling unit, geography, and owner, and masks phone numbers. It never returns email addresses or voter-card numbers.

Optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `stateId`, `lgaId`, `wardId`, `politicalUnitId` | Restrict results geographically |
| `ownerGroupId` | Restrict to assignments for a particular party/campaign/support/admin group owner |
| `ownerCandidateId` | Restrict to assignments for a candidate |
| `agentKind` | `official` or `extra` |
| `cursor` | Opaque cursor from the previous response's `meta.nextCursor` |
| `limit` | Page size, default `50`, range `1–100` |

Filters may be combined. Non-admin candidates may not use `lgaId`. Invalid filters return `400`. Each page read writes an audit event. The response is a success envelope whose `data` is an array of assignments and whose `meta` contains `nextCursor` (null when finished) and `limit`. Each item includes the assignment ID/kind/slot, person ID/name, masked phone, polling-unit and hierarchy details, and an `owner` with `type` (`group` or `candidate`), ID, and display name.

### Coverage API

`GET /api/coverage/summary` returns `totalPUs`, `coveredPUs`, `noCoveragePUs`, `gpsPUs`, `extraAgentsCount`, and `officialAgentPct` for the caller's accessible geography. `coveredPUs` counts polling units with an official assignment. `officialAgentPct` is rounded to a whole-number percentage and is zero if there are no polling units.

Both `GET /api/coverage/summary` and `GET /api/coverage/gaps` accept optional `stateId`, `lgaId`, `wardId`, and `politicalUnitId` query filters. A supplied filter must be a positive integer; multiple filters are ANDed together and are always intersected with the caller's access scope.

`GET /api/coverage/gaps` returns polling units with **no official assignment**, with their code/name, coordinates and `hasGPS`, plus ward/LGA/state code and name. It accepts `limit` from `1` to `500` (default `100`) and `offset` (non-negative integer, default `0`). Its `data` contains `totalCount`, `limit`, `offset`, and `items`. The reported gaps do not imply that there are no extra agents at those units.

### Assignment API

An assignment is a row in `agent_assignment` linking one existing `person` to one `polling_unit` and exactly one owner: a group or a candidate. It records that the person represents that owner at that polling unit.

Create one with `POST /api/coverage/assignments`:

```json
{
  "personId": "03ea6f24-8b10-4f97-95f5-9913c6b79676",
  "pollingUnitId": 120,
  "ownerGroupId": 4,
  "ownerCandidateId": null,
  "agentKind": "official",
  "slotNumber": 0
}
```

| Field | Type and rules | Database meaning |
| --- | --- | --- |
| `personId` | UUID | Existing `person.id` for the agent |
| `pollingUnitId` | Positive integer | Existing `polling_unit.id` where the person will serve |
| `ownerGroupId` | Positive integer or `null` | Existing `groups.id`, commonly a party or campaign; null when candidate-owned |
| `ownerCandidateId` | Positive integer or `null` | Existing `candidate.id`; null when group-owned |
| `agentKind` | `official` or `extra` | Assignment category |
| `slotNumber` | Integer; `0` for official, `1+` for extra | Slot/position for the assignment category |

Exactly one of `ownerGroupId` and `ownerCandidateId` must be non-null. Party and campaign members may manage assignments for their own group; a candidate may manage assignments owned by their own candidate record; admins may manage any owner. In all cases, the caller must have scope access to the polling unit. The request must include an `Origin` header matching the request origin.

Official assignments use slot `0`, and the database enforces at most one official assignment per polling unit. Extra assignments use positive slot numbers. The database also enforces that the person, polling unit, and owner references exist and that exactly one owner is supplied. Successful creation returns HTTP `201` and `data: { "ok": true, "id": "<assignment UUID>" }`. The insert and its `audit_log` event are in one transaction.

To find a group's ID for `ownerGroupId`, query the database rather than assuming IDs are the same between deployments:

```sql
SELECT id, group_name, group_type
FROM groups
WHERE group_type IN ('party', 'campaign')
ORDER BY group_type, group_name;
```

To find a person UUID or polling-unit ID, use `person` and `polling_unit` respectively. These IDs are unrelated: `ownerGroupId` is a `groups.id`, while `ownerCandidateId` is a `candidate.id`.

Delete with `DELETE /api/coverage/assignments/{assignmentId}`. The caller must be in scope for the assignment's polling unit and authorized for its owner. Success returns `{ "status": "success", "data": { "ok": true } }`; deletion and its audit event are transactional. An inaccessible or nonexistent assignment returns `404`.

### Development and documentation endpoints

- `GET /api/health` performs `SELECT 1` against PostgreSQL. It does not expose connection details.
- `GET /api/openapi` serves `public/openapi.yaml`; `SERVER_BASE_URL` can override its server base URL.
- `GET /api/docs` serves Swagger UI. Sign in in that browser session before trying protected operations.
- `GET /api/dev/queue-test` reports queue counts; `POST /api/dev/queue-test` enqueues test jobs. Both return `404` in production. See [Worker](#worker) for the smoke-test procedure.

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

## Database model and API relationships

The PostgreSQL schema is authoritative. TypeORM entity classes describe the same tables for application code, but migrations create and change the schema; `synchronize` is disabled. See `lib/db/entities/` for entity mappings and `lib/db/migrations/` for constraints and indexes.

### High-level relationship map

```mermaid
erDiagram
  STATE ||--o{ LGA : contains
  LGA ||--o{ WARD : contains
  WARD ||--o{ POLLING_UNIT : contains
  POLLING_UNIT ||--o{ PU_POLITICAL_UNIT : maps
  POLITICAL_UNIT ||--o{ PU_POLITICAL_UNIT : maps
  PERSON ||--o{ PHONE_NUMBER : has
  PERSON ||--o{ MEMBERSHIP : joins
  GROUPS ||--o{ MEMBERSHIP : includes
  MEMBERSHIP ||--o{ MEMBERSHIP_SCOPE_UNIT : grants
  PERSON ||--o{ CANDIDATE : may_be
  OFFICE ||--o{ SEAT : defines
  POLITICAL_UNIT ||--o{ SEAT : locates
  PERSON ||--o{ AGENT_ASSIGNMENT : serves
  POLLING_UNIT ||--o{ AGENT_ASSIGNMENT : staffed_at
  GROUPS ||--o{ AGENT_ASSIGNMENT : owns
  CANDIDATE ||--o{ AGENT_ASSIGNMENT : owns
  PERSON ||--o{ AUTH_SESSION : signs_in
  PERSON ||--o{ LOGIN_OTP : receives
  PERSON ||--o{ AUDIT_LOG : acts
  BROADCAST ||--o{ DELIVERY : creates
  PERSON ||--o{ DELIVERY : receives
```

In the diagram, `groups` is named `GROUPS` because `GROUPS` is a Mermaid keyword-like identifier. The actual PostgreSQL table is `groups`.

### API-to-table map

| API area | Main tables read or written |
| --- | --- |
| OTP request | `person`, `membership`, `candidate`, `auth_rate_limit`, `login_otp` |
| OTP verify | `person`, `auth_rate_limit`, `login_otp`, `auth_session` |
| Session, permissions, logout | `auth_session`, `person`, `membership`, `groups`, `membership_scope_unit`, `candidate` |
| Agent list | `agent_assignment`, `person`, `phone_number`, `polling_unit`, `ward`, `lga`, `state`, `groups`, `candidate`, `group_visibility_grant`, `audit_log` |
| Geography | `state`, `lga`, `ward`, `polling_unit`, `agent_assignment`, `person`, `phone_number`, `pu_political_unit`, plus membership scope tables |
| Coverage summary and gaps | `state`, `lga`, `ward`, `polling_unit`, `agent_assignment`, `pu_political_unit`, plus membership scope tables |
| Assignment create/delete | `person`, `polling_unit`, `agent_assignment`, `groups` or `candidate`, membership/scope tables, `audit_log` |
| Health | Database connection only (`SELECT 1`) |

### Core relational tables

| Table | What a row represents | Important relationships and use |
| --- | --- | --- |
| `state` | An electoral state, with an INEC code and name | Parent of `lga`; top geography level |
| `lga` | A local government area | `state_id → state.id`; parent of `ward` |
| `ward` | A ward | `lga_id → lga.id`; parent of `polling_unit` |
| `polling_unit` | A polling unit, including its INEC code, optional name and coordinates | `ward_id → ward.id`; destination location for an agent assignment |
| `political_unit` | Country, state, senatorial district, federal constituency, or state constituency | Can have a parent political unit; many-to-many with polling units through `pu_political_unit` |
| `pu_political_unit` | The mapping between a polling unit and a political unit | Composite key `(political_unit_id, polling_unit_id)`; enables political-unit filtering and access scopes |
| `person` | A human identity, including name, optional email, optional home polling unit, voter-card number and verification status | Referenced by memberships, candidates, assignments, OTPs, sessions, phones, consent, broadcasts, deliveries and audit events. “Agent” is a role recorded by `agent_assignment`, not a separate `agents` table. |
| `phone_number` | A phone contact for a person | `person_id → person.id`; stores E.164 number, confirmation flag and optional Telegram chat ID |
| `consent` | A person's acceptance/rejection of a versioned consent text | `person_id → person.id`; one person can have records for multiple versions |
| `groups` | A party, campaign, support group, or admin group | `group_type` is `party`, `campaign`, `support_group`, or `admin`; optional `parent_group_id → groups.id` |
| `membership` | A person's membership in a group and their role label | Join table between `person` and `groups`; unique per person/group |
| `membership_scope_unit` | A geographic/political scope attached to a membership | `membership_id → membership.id`; exactly one of state, LGA, ward, or political-unit scope must be set |
| `group_visibility_grant` | Whether one group may see another group's owned agents | `viewer_group_id` and `owner_group_id` both reference `groups`; only explicit grants are used in v1 (parent-group inheritance is not applied) |
| `office` | An elected office type, its hierarchy level, and the kind of political unit it represents | Referenced by `seat` |
| `seat` | An office contest in a particular political unit | `office_id → office.id`; `political_unit_id → political_unit.id`; unique per office/political-unit pair |
| `candidate` | A candidate person and their seat, or a running-mate relationship | `person_id → person.id`; optional `seat_id → seat.id`; optional `principal_candidate_id → candidate.id`. The schema requires a seat or a principal candidate, but not both. |
| `agent_assignment` | One person's role at one polling unit on behalf of one owner | References `person`, `polling_unit`, and exactly one of `groups` or `candidate`; this is the source for agent listings and live coverage counts |
| `audit_log` | An auditable actor/action/target event and optional IP address | `actor_person_id → person.id` when the actor still exists; written for assignment create/delete and agent-list page reads |

### Authentication tables

| Table | What it stores |
| --- | --- |
| `login_otp` | Person ID, HMAC OTP hash, expiry, consumption time, attempt counter, request IP and creation time. The raw OTP is not stored. |
| `auth_session` | Person ID, unique SHA-256 session-token hash, absolute expiry, last activity, optional revocation time, creation IP and timestamp. The raw cookie token is not stored. |
| `auth_rate_limit` | Hashed rate-limit bucket key, fixed-window start, and hit count; unique per bucket/window pair. Required by OTP request and verification. |

### Operational and reporting tables

| Table | What it stores | API status |
| --- | --- | --- |
| `coverage_count` | A refreshed aggregate for exactly one state, LGA, ward, or political-unit scope, optionally grouped by owner; records covered/total counts and refresh time | The current geography and coverage routes calculate counts from live geography and `agent_assignment` joins; they do not read this aggregate table |
| `election_day` | An election date and optional label | Supports election configuration |
| `election_day_office` | Offices scheduled for an election day | Join table between election day and office |
| `election_day_off_cycle_state` | States with an off-cycle election for an election day | Join table between election day and state |
| `broadcast` | Message text, audience filter, sender, schedule and broadcast status | Data model exists; a broadcast API/worker workflow is not currently exposed |
| `delivery` | Per-person delivery status/channel and delivery timestamps for a broadcast | References `broadcast` and `person`; unique per broadcast/person |
| `access_link` | Candidate access-link token hash, expiry and revocation state | References `candidate`; raw token is not stored |
| `import_batch` | Import filename, uploader, row counts and JSON error details | References the uploader in `person`; import API/workflow is not currently exposed |

The job queue's pg-boss tables are managed by pg-boss in PostgreSQL and are not TypeORM application entities.

### IDs and assignment ownership

IDs are table-specific, not interchangeable. `person.id` and `agent_assignment.id` are UUIDs. Geography, group, candidate, office, seat and membership IDs are integer serial IDs; `audit_log.id` and `coverage_count.id` are bigserial IDs. Always query the relevant table to obtain an ID.

For example, `ownerGroupId: 18` means `groups.id = 18`; it does not mean candidate 18 or person 18. Party and campaign are distinct `groups.group_type` values. A group can own an assignment through `owner_group_id`; an individual candidate can own one through `owner_candidate_id`. The assignment table permits only one of these owner columns to be non-null.

```sql
-- Find party/campaign ownerGroupId values.
SELECT id, group_name, group_type
FROM groups
WHERE group_type IN ('party', 'campaign')
ORDER BY group_type, group_name;

-- Find an agent's personId.
SELECT id, full_name, email_address
FROM person
WHERE LOWER(email_address) = LOWER('agent@example.com');

-- Find a pollingUnitId by its INEC code.
SELECT pu.id, pu.inec_polling_unit_code, w.ward_name, l.lga_name, s.state_name
FROM polling_unit pu
JOIN ward w ON w.id = pu.ward_id
JOIN lga l ON l.id = w.lga_id
JOIN state s ON s.id = l.state_id
WHERE pu.inec_polling_unit_code = 'YOUR-INEC-CODE';
```

### Assignment constraints and coverage meaning

- `agent_assignment` is the association between a person and a polling unit; inserting into it does not create a person, grant a login, or set a person's verification status.
- Every assignment has exactly one owner: `owner_group_id` or `owner_candidate_id`.
- `agent_kind = 'official'` requires `slot_number = 0`; a partial unique index permits at most one official agent at each polling unit.
- `agent_kind = 'extra'` requires `slot_number >= 1`.
- The API additionally rejects an already occupied owner/kind/slot combination and the database constraints remain the final protection against races and invalid references.
- Coverage endpoints consider an official assignment sufficient to mark a polling unit covered. Extra assignments are counted separately and do not close an official coverage gap.

### Authorization and policy boundary

Authentication answers **who is making the request**; group membership and scope answer **which data they may access**; assignment-owner checks answer **which owner they may manage**.

- `membership` connects a person to a group and its `membership_role` label. `membership_scope_unit` limits that membership to one state, LGA, ward, or political unit per row.
- `requireApiAuth` validates the cookie-backed session, loads all memberships/scopes and rejects authenticated people with no membership for routes using this helper. The agent-list endpoint uses the policy layer and may also represent a candidate-only user.
- Admin and party group memberships currently grant global scope for geography and coverage. Other users' reads are restricted to their recorded membership scopes.
- Assignment creation/deletion independently checks the polling-unit scope and owner authorization. Admins may manage any owner; a member may manage their own party/campaign group; a candidate may manage their own candidate-owned assignment.
- `GET /api/agents` also applies owner visibility via `group_visibility_grant` and geographical scope via `membership_scope_unit`/candidate seat. Explicit viewer-to-owner grants are used; group-parent inheritance is not applied. The current policy treats admins and users with no group memberships as unfiltered by owner, with geography scope still applied.
- Agent-list phone numbers are masked in the response. Email and voter-card number are not returned.

Keep API reads in the existing `lib/policy` layer where they are policy-managed. Route handlers should not import `typeorm`, `pg`, or `lib/db` directly for new API reads. Geography and coverage route handlers currently own their SQL and must explicitly join every alias referenced by the shared scope predicate (`s`, `l`, `w`, and `pu`).
