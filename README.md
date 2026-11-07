# Collate

Collate is a polling-unit coverage and messaging system for one Nigerian political party. It answers two questions: **who is covering which polling unit**, and **can we reach them quickly on election day**.

## Table of contents

1. [Overview](#1-overview)
2. [System architecture](#2-system-architecture)
3. [Frontend](#3-frontend)
4. [API](#4-api)
   - [Tech stack](#41-tech-stack)
   - [Architecture](#42-architecture)
   - [Security and defence notes](#43-security-and-defence-notes)
   - [Data models](#44-data-models)
   - [ERD](#45-erd)
   - [Endpoints](#46-endpoints)
5. [Worker](#5-worker)
6. [Environment variables](#6-environment-variables)
7. [Getting started](#7-getting-started)
8. [Testing, deployment and contributing](#8-testing-deployment-and-contributing)
9. [License and contact](#9-license-and-contact)
10. [Data sources and attribution](#10-data-sources-and-attribution)
11. [Notes / TODO](#11-notes--todo)

---

## 1. Overview

### The problem

A party has to cover about 177,000 polling units across 37 states, 774 LGAs and 8,800+ wards. Someone has to know which units have an agent and which don't, and has to reach those agents during an election. Spreadsheets and WhatsApp groups don't scale, don't respect who is allowed to see what, and leak phone numbers.

### What Collate does

- **Coverage dashboard.** Drill down state → LGA → ward → polling unit, see coverage gaps, and plot available polling-unit coordinates on an interactive map.
- **Agent management.** Assign people to polling units as the official agent (one per unit) or as extra agents (any number). Every change is audited.
- **Candidate coverage.** See how well each candidate's seat is covered.
- **Broadcasts.** Preview an audience, write a message, send now or schedule it. Telegram goes first, SMS is the fallback. Delivery is tracked per person, including an "OK" tap from the agent.
- **Scoped access.** Users sign in with an email code. What they can see is limited by their group membership and geographic scope. Phone numbers are always masked.

### Key features

| Feature | Notes |
| --- | --- |
| Passwordless sign-in | Email OTP, server-side sessions, HTTP-only cookie |
| Scope-based access | Membership scope and group visibility are applied inside SQL, not after fetching |
| Cursor pagination | Lists are capped at 100 rows (the coverage gaps list is the exception) |
| Background sending | A separate worker sends broadcasts through a Postgres-backed queue (pg-boss) |
| Consent aware | Telegram is used only after the person accepts the consent text; a decline excludes them |
| Append-only audit log | A database trigger rejects `UPDATE` and `DELETE` on `audit_log` |
| Real INEC data | States, LGAs, wards, polling units, political units, seats and NDC candidates seeded from INEC sources |
| Documented API | OpenAPI 3.1 spec at `/api/openapi`, Swagger UI at `/api/docs` |

---

## 2. System architecture

```mermaid
flowchart LR
  User["Browser<br/>(party / campaign / admin user)"]
  Agent["Polling-unit agent<br/>(Telegram app)"]

  subgraph Vercel["Next.js app (Vercel)"]
    UI["Frontend<br/>App Router pages + React Query"]
    API["REST API<br/>app/api/**/route.ts"]
    Policy["lib/auth + lib/policy<br/>session, scope, masking, audit"]
    Producer["lib/queue<br/>pg-boss producer"]
    Bot["Telegram webhook<br/>grammY bot"]
  end

  subgraph Render["Worker (Render background worker)"]
    Worker["worker/index.ts<br/>pg-boss consumer, no HTTP port"]
  end

  PG[("PostgreSQL (Neon)<br/>app tables + pg-boss tables")]
  TG["Telegram Bot API"]
  Brevo["Brevo<br/>OTP email, SMS fallback"]

  User -->|"HTTPS, session cookie"| UI
  UI -->|"fetch /api/*"| API
  API --> Policy
  Policy -->|"TypeORM + parameterised SQL"| PG
  API --> Producer
  Producer -->|"enqueue job"| PG
  API -->|"send OTP email"| Brevo
  Worker <-->|"poll, lock, ack jobs; read and write deliveries"| PG
  Worker -->|"sendMessage"| TG
  Worker -->|"SMS fallback"| Brevo
  TG -->|"messages"| Agent
  Agent -->|"share contact, consent, OK tap"| TG
  TG -->|"webhook POST + secret header"| Bot
  Bot --> PG
```

**How data flows**

1. A user signs in with an email OTP. The API stores a hashed session token and sets an HTTP-only cookie.
2. The frontend calls `/api/*` with that cookie. Route handlers call `lib/auth` and `lib/policy`, which build SQL filtered by the caller's scope and return masked data.
3. Creating a broadcast writes a `broadcast` row and an audit row in one transaction, then enqueues a `broadcast-resolve` job in Postgres and returns `201` straight away.
4. The worker picks the job up, turns the audience into one `delivery` row per person, and enqueues one `delivery-send` job per delivery.
5. Each `delivery-send` job tries Telegram, falls back to SMS where it makes sense, and updates the delivery status.
6. When an agent messages the bot, Telegram POSTs to `/api/telegram/webhook`. The bot links the chat to a phone number, records consent, and records "OK" taps on deliveries.

The API and the worker never call each other. The database (including the queue tables) is their only shared channel.

---

## 3. Frontend

### Tech stack and why

| Piece | Version | Why it's used |
| --- | --- | --- |
| Next.js (App Router) | 16.4.3 | One deployable for UI and API. `cacheComponents` and `partialPrefetching` are enabled |
| React | 19.3.0 | Required by Next 16 |
| TanStack React Query | ^5 | Server-state cache, loading and error states, infinite lists ("Load more") |
| Tailwind CSS | 4 | Utility styling; compiled through `@tailwindcss/turbopack` |
| MapLibre GL + `react-map-gl` | ^6 / ^8 | Interactive, clustered coordinate map on the Coverage page |
| shadcn + `@base-ui/react` | 4.x / 1.x | Accessible unstyled primitives with our own styling (`components/ui`) |
| `lucide-react` | ^1 | Icons |
| `class-variance-authority`, `clsx`, `tailwind-merge` | | Variant and class-name helpers used by `components/ui` |
| TypeScript | ^5.9 | Shared types between hooks and pages (`types/api.ts`) |

### Folder structure

```text
app/
  layout.tsx            Root layout: QueryProvider > AppProvider > TooltipProvider, sidebar, mobile nav
  page.tsx              Dashboard (/)
  login/                Email OTP sign-in
  candidates/           Candidate coverage
  coverage/             State → LGA → ward → polling-unit drill-down and gaps
  agents/               Agent list and the assign flow
  recipients/           Reachable agents, Telegram readiness, CSV export
  broadcasts/           List, /new, and /[id] detail
  settings/             Settings screens
  admin/queue/          Admin queue inspector
  api/                  REST route handlers (see section 4)
components/
  ui/                   shadcn / base-ui primitives
  layout/               Sidebar, mobile nav, bottom bar, "view as" bar
  providers/            QueryProvider
  agents/ broadcasts/ candidates/ coverage/ recipients/ settings/   Feature components
lib/
  api/client.ts         apiClient / apiFetch wrapper (credentials: "include")
  hooks/                React Query hooks: use-auth, use-agents, use-broadcasts,
                        use-candidates, use-coverage, use-geography
  context/app-context.tsx   AppProvider (see Notes / TODO)
types/api.ts            API response types shared with the hooks
```

### Routing

File-based App Router routes:

| Route | Purpose |
| --- | --- |
| `/` | Dashboard |
| `/login` | Request and verify an email code |
| `/candidates` | Candidate coverage by office, with filters |
| `/coverage` | Geography drill-down and coverage gaps |
| `/agents` | Agent list, assign and remove |
| `/recipients` | Agents as broadcast recipients, with search, filters and Telegram-ready counts |
| `/broadcasts`, `/broadcasts/new`, `/broadcasts/[id]` | Broadcast history, composer, detail and deliveries |
| `/settings` | Settings |
| `/admin/queue` | Queue counts and recent jobs (admin only) |

There is no `middleware`/`proxy` file. Pages that call protected APIs redirect to `/login` on a `401`, and the sidebar and mobile nav hide themselves on `/login`. The real access control is always the API.

### State management and API integration

- **Server state** lives in React Query. Hooks in `lib/hooks/` wrap `apiClient` and own the query keys (for example `AUTH_KEYS`).
- `apiClient` (`lib/api/client.ts`) sends `credentials: "include"` and throws `ApiClientError` carrying the API error code, so pages can handle `401` and `403` cleanly.
- Lists use `useInfiniteQuery` with `meta.nextCursor` (agents page size 50).
- Mutations invalidate the related queries. For example, verifying an OTP invalidates the session and permissions queries.
- **UI state** (filters, dialogs) stays local to each page. The debounced search on `/recipients` is an example.
- The Coverage page requests grouped coordinate counts from `/api/coverage/map-points` for the selected geography, then renders them in a client-only MapLibre map. It starts focused on Nigeria, limits panning to Nigeria's approximate coordinate bounds, clusters nearby locations, and lets users toggle covered, gap and mixed markers. Mixed markers are smaller and show coverage counts on hover; clicking a location shows its counts without returning agent details. Map controls have larger touch targets, and the map height adapts to mobile viewports. National overview and geography drill-down cards are omitted. OpenStreetMap raster tiles and MapLibre demo glyphs are loaded externally; the attribution is shown on the map. Coordinates may be approximate and are not suitable for navigation without verification.

### Run the frontend

The frontend ships with the API in one Next.js app. See [Getting started](#7-getting-started):

```sh
npm install
npm run dev        # http://localhost:3000
```

---

## 4. API

### 4.1 Tech stack

| Piece | Why |
| --- | --- |
| Next.js route handlers (`app/api/**/route.ts`) | One deployable for UI and API |
| PostgreSQL (Neon) | The domain is relational and rule-heavy; the database is the last line of defence for invariants |
| TypeORM 1.x (`DataSource`, entities, migrations) | Structure and migrations. `synchronize` is always off |
| Parameterised raw SQL | Scope filters and aggregates need control that the ORM makes awkward |
| `pg` | Postgres driver (kept external to the bundle via `serverExternalPackages`) |
| Zod 4 | Input validation at the API boundary |
| pg-boss 12 | Durable queue inside the same Postgres, so no Redis |
| grammY (+ `@grammyjs/auto-retry`) | Telegram bot and webhook |
| Brevo | OTP email and SMS fallback |
| `libphonenumber-js` | Phone normalisation to E.164 |

### 4.2 Architecture

**Layers**

| Layer | Where | Responsibility |
| --- | --- | --- |
| Route handlers | `app/api/**/route.ts` | Parse input, call one function, shape the response. They never import `lib/db` or `typeorm` (enforced by `lib/policy/route-imports.test.ts`) |
| Auth | `lib/auth/*` | OTP, sessions, rate limits, `requireUser`, `requireApiAuth`, origin check |
| Policy | `lib/policy/*` | Scope, visible owners, masking, pagination, audit. Everything about "who may see what" |
| Domain services | `lib/broadcast`, `lib/coverage`, `lib/admin` | Broadcast creation and queries, coverage queries, queue stats |
| Channels | `lib/channels/telegram`, `lib/channels/sms` | Telegram bot and adapter, SMS channel behind an interface |
| Queue (producer) | `lib/queue` | `enqueue()` with the default retry policy |
| Data | `lib/db` | Entities, migrations, seeds, data source |
| Response helpers | `lib/api/response.ts`, `lib/api/error-codes.ts` | `success()`, `failure()`, `internalError()` |

**Folder structure (backend)**

```text
app/api/                     Route handlers
lib/api/                     Response envelope and error codes
lib/auth/                    Sessions, OTP, rate limiting, cookies, request helpers
lib/policy/                  Scope and visibility policy, schemas, error mapping
lib/policy/core/             list-agents, audience, scope queries, ward polling units
lib/broadcast/               Zod schemas, createBroadcast, list and detail queries
lib/channels/                telegram/ (bot, handlers, adapter, limiter) and sms/
lib/queue/                   Producer (index.ts) and shared queue names (names.ts)
lib/db/                      data-source.ts, entities/, migrations/, seeds/
worker/                      Standalone worker (section 5)
scripts/                     INEC scrapers/extractors and Telegram webhook helpers
```

**Request lifecycle**

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Route handler
  participant A as lib/auth
  participant P as lib/policy
  participant D as PostgreSQL

  C->>R: HTTP request + session cookie
  R->>R: (POST/DELETE) same-origin check
  R->>A: requireUser() / requireApiAuth()
  A->>D: look up hashed session token, touch last_active_at
  A-->>R: current user (or 401 / 403)
  R->>R: Zod-parse query, params, body (400 on failure)
  R->>P: call policy/service function
  P->>D: scoped, parameterised SQL (+ audit_log insert where required)
  D-->>P: rows
  P-->>R: masked, paginated result
  R-->>C: { status: "success", data, meta? } or { status: "error", error }
```

**Authentication**

1. `POST /api/auth/otp/request`: the email must belong to an existing, eligible person (a `membership` or `candidate` row). A 6-digit code is generated, only its HMAC-SHA256 hash (keyed with `AUTH_SECRET` and bound to the person) is stored, and the code is emailed.
2. `POST /api/auth/otp/verify`: checks the hash with `timingSafeEqual`, burns the code, creates an `auth_session` row (only the SHA-256 hash of the token is stored), and sets the cookie.
3. The cookie is `collate_session` in development and `__Host-collate_session` in production (`HttpOnly`, `SameSite=Lax`, `Secure` in production).
4. Sessions last 12 hours and expire after 2 hours idle. Logout deletes the row.

| Limit | Value |
| --- | --- |
| OTP validity | 10 minutes, single use |
| Failed attempts per code | 5 |
| OTP requests | 5/hour per email, 20/hour per IP |
| OTP verifications | 10 per 15 minutes per email hash and per IP |

**Authorization**

`requireApiAuth` loads the person's memberships. A person with no membership gets `403`. Roles come from `groups.group_type`:

| Flag | Rule |
| --- | --- |
| `isAdmin` | member of an `admin` group |
| `canManageCoverage` | member of an `admin`, `party` or `campaign` group |
| `hasGlobalCoverageAccess` | member of an `admin` or `party` group |
| Scope | `membership_scope_unit` rows limit a membership to a state, LGA, ward or political unit |

Out-of-scope resources return `404`, not `403`, so their existence isn't revealed. Agent reads also apply `group_visibility_grant`.

**Validation**

Zod schemas live next to the code that uses them (`lib/policy/schemas.ts`, `lib/broadcast/schemas.ts`, `lib/auth/schemas.ts`). Filters, IDs and cursors are validated before they reach SQL. Validation failures are always `400 validation_failed` with an optional `fields` map. The API never returns `422`.

**Error handling**

Handlers catch everything, log server-side, and return a generic `500 internal_error`. Database errors and connection strings are never returned.

| Code | HTTP |
| --- | --- |
| `validation_failed`, `invalid_filter` | 400 |
| `unauthorized`, `invalid_or_expired_code` | 401 |
| `forbidden`, `invalid_origin` | 403 |
| `not_found` | 404 |
| `conflict` | 409 |
| `too_many_requests` | 429 (`Retry-After: 60`, except on OTP request) |
| `internal_error` | 500 |

```json
{ "status": "error", "error": { "code": "validation_failed", "message": "Invalid request parameters", "fields": { "limit": "must_be_at_most_100" } } }
```

### 4.3 Security and defence notes

Short answers for a technical review.

| Question | Answer |
| --- | --- |
| Why Postgres and a relational model? | Invariants live in the database so no code path or race can break them (see the constraints table below) |
| Why a queue and a worker? | Sending thousands of messages inside a request would time out and couldn't respect Telegram's rate limit. Create returns `201` immediately |
| Why pg-boss, not Redis? | One stateful system to host and secure. Durable jobs, retries, backoff, scheduling and de-duplication come from the database we already run |
| Why modular monolith, not microservices? | One team, one database. The queue is the seam if something has to split later |
| How is "who sees what" enforced? | Scope and visibility are SQL predicates, not post-filters. Out-of-scope IDs return `404` |
| Why one official agent per polling unit? | The system serves a single party, so each unit has one official agent and any number of extras. `uq_agent_assignment_official_polling_unit` enforces it |
| Two people assign the same unit at once? | Assignment creation locks the polling-unit row (`FOR UPDATE`), and the unique index returns `409` as a safety net |
| Worker crashes mid-broadcast? | pg-boss retries. `delivery-send` is idempotent on delivery status and `singletonKey` stops duplicates |
| Can the audit log be tampered with? | Not through the app or normal SQL: a trigger rejects `UPDATE` and `DELETE`. A database superuser could drop the trigger |
| Stolen session cookie? | At most 12 hours (2 hours idle). `HttpOnly`. Only the hash is stored, and deleting the row revokes it |
| CSRF? | `SameSite=Lax` plus an `Origin` match on every mutating route (assignments, broadcasts, preview) |
| SQL injection? | Parameterised queries and Zod validation for every ID, filter and cursor |
| Is personal data protected? | Phones are masked in all responses. Email and voter card numbers are never returned. Job payloads carry IDs only |

Database-level constraints that back these answers:

| Constraint | What it enforces |
| --- | --- |
| `uq_agent_assignment_official_polling_unit` | At most one `official` agent per polling unit (partial unique index) |
| `ck_agent_assignment_owner_xor` | An assignment has exactly one owner: group or candidate |
| `ck_agent_assignment_slot` | Official agents use slot `0`; extra agents use slot `1` or more |
| `ck_phone_number_e164` | Phone numbers look like E.164 (`^\+[1-9][0-9]{6,14}$`) |
| unique `LOWER(email_address)` | Case-insensitive unique email on `person` |
| `ck_candidate_seat_or_principal` | A candidate has either a seat or a principal (running mate), never both or neither |
| `ck_membership_scope_unit_exactly_one` | A scope row targets exactly one of state, LGA, ward, political unit |
| `ck_coverage_count_*` | One unit scope per row; covered count never exceeds total |
| unique `(broadcast_id, person_id)` on `delivery` | A person can't get the same broadcast twice |
| `audit_log_append_only` trigger | `audit_log` rows can't be updated or deleted |

### 4.4 Data models

PostgreSQL, 30 tables, created by the migrations in `lib/db/migrations/`. `synchronize` is off. Every table has a TypeORM entity in `lib/db/entities/`.

Conventions: `serial`/`bigserial` ids are auto-increment, `uuid` ids default to `gen_random_uuid()`, `timestamptz` timestamps default to `NOW()`. "FK" means a foreign key. Tables are grouped by domain.

**Enums**

| Enum | Values |
| --- | --- |
| `political_unit_type` | `country`, `state`, `senatorial_district`, `federal_constituency`, `state_constituency` |
| `verification_status` | `unverified`, `verified`, `rejected` |
| `group_type` | `party`, `campaign`, `support_group`, `admin` |
| `agent_kind` | `official`, `extra` |
| `broadcast_status` | `draft`, `scheduled`, `sending`, `completed`, `failed`, `cancelled` |
| `delivery_channel` | `telegram`, `sms` |
| `delivery_status` | `pending`, `sent`, `delivered`, `delivered_by_sms`, `failed`, `tapped_ok` |
| `coverage_kind` | `headline`, `group` |

#### Geography

**`state`**: an INEC state.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| inec_state_code | varchar | unique, not null |
| state_name | varchar | not null |
| created_at | timestamptz | `NOW()` |

Relationships: has many `lga`.

**`lga`**: a local government area.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| state_id | int | FK `state.id` (RESTRICT), not null |
| inec_lga_code | varchar | unique with `state_id` |
| lga_name | varchar | not null |
| created_at | timestamptz | `NOW()` |

Relationships: belongs to `state`; has many `ward`.

**`ward`**: an electoral ward.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| lga_id | int | FK `lga.id` (RESTRICT), not null |
| inec_ward_code | varchar | unique with `lga_id` |
| ward_name | varchar | not null |
| created_at | timestamptz | `NOW()` |

Relationships: belongs to `lga`; has many `polling_unit`.

**`polling_unit`**: a polling location.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| inec_polling_unit_code | varchar | unique, not null (full path, e.g. `24/01/01/001`) |
| polling_unit_name | varchar | nullable |
| ward_id | int | FK `ward.id` (RESTRICT), not null |
| latitude, longitude | double precision | nullable |
| is_position_doubtful | boolean | `FALSE` |
| created_at | timestamptz | `NOW()` |

Relationships: belongs to `ward`; many-to-many with `political_unit` via `pu_political_unit`; has many `agent_assignment`; referenced by `person.home_polling_unit_id`.

**`political_unit`**: a hierarchical constituency (country, state, senatorial district, federal or state constituency).

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| political_unit_name | varchar | not null |
| political_unit_type | `political_unit_type` | not null |
| parent_political_unit_id | int | FK `political_unit.id` (RESTRICT), nullable |
| created_at | timestamptz | `NOW()` |

Index: `(political_unit_type, parent_political_unit_id)`. Relationships: self-referencing parent; has many `seat`.

**`pu_political_unit`**: which polling units belong to which political unit.

| Field | Type | Constraints / default |
| --- | --- | --- |
| political_unit_id | int | PK part, FK `political_unit.id` (CASCADE) |
| polling_unit_id | int | PK part, FK `polling_unit.id` (CASCADE) |

Index on `polling_unit_id`.

#### People

**`person`**: one identity record for everyone: users, agents and candidates.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| full_name | varchar | not null |
| home_polling_unit_id | int | FK `polling_unit.id` (SET NULL), nullable |
| email_address | varchar | nullable; unique on `LOWER(email_address)` where not null |
| voter_card_number | varchar | nullable (never returned by the API) |
| verification_status | `verification_status` | `unverified` |
| created_at, updated_at | timestamptz | `NOW()` |

Relationships: has many `phone_number`, `consent`, `membership`, `candidate`, `agent_assignment`, `login_otp`, `auth_session`, `broadcast` (as sender), `delivery`, `import_batch`, `audit_log` (as actor).

**`phone_number`**: a person's phone and Telegram link.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| person_id | uuid | FK `person.id` (CASCADE), not null |
| e164_number | varchar | unique, not null; check `^\+[1-9][0-9]{6,14}$` |
| is_confirmed | boolean | `FALSE` |
| telegram_chat_id | bigint | unique, nullable |
| created_at, updated_at | timestamptz | `NOW()` |

**`consent`**: consent history. The newest row decides.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| person_id | uuid | FK `person.id` (CASCADE), not null |
| consent_text_version | varchar | not null (current: `v0-draft`) |
| is_accepted | boolean | not null |
| created_at | timestamptz | `NOW()` |

#### Elections and candidates

**`office`**: an office that can be contested.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| office_name | varchar | unique, not null |
| hierarchy_level | int | not null |
| political_unit_type | `political_unit_type` | not null |
| created_at | timestamptz | `NOW()` |

**`election_day`**: an election event.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| election_date | date | unique, not null |
| election_label | varchar | nullable |
| created_at | timestamptz | `NOW()` |

**`election_day_office`**: offices contested on an election day.

| Field | Type | Constraints / default |
| --- | --- | --- |
| election_day_id | int | PK part, FK `election_day.id` (CASCADE) |
| office_id | int | PK part, FK `office.id` (CASCADE) |

**`election_day_off_cycle_state`**: states that vote on an election day because they are off-cycle.

| Field | Type | Constraints / default |
| --- | --- | --- |
| election_day_id | int | PK part, FK `election_day.id` (CASCADE) |
| state_id | int | PK part, FK `state.id` (CASCADE) |

**`seat`**: one office contested in one political unit.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| office_id | int | FK `office.id` (RESTRICT), not null |
| political_unit_id | int | FK `political_unit.id` (RESTRICT), not null |
| created_at | timestamptz | `NOW()` |

Unique `(office_id, political_unit_id)`.

**`candidate`**: a candidate, or a principal's running mate.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| person_id | uuid | FK `person.id` (RESTRICT), not null |
| seat_id | int | FK `seat.id` (SET NULL), nullable |
| principal_candidate_id | int | FK `candidate.id` (SET NULL), nullable |
| created_at, updated_at | timestamptz | `NOW()` |

Checks: exactly one of `seat_id` / `principal_candidate_id` is set, and a candidate can't be their own principal. Running mates (VP, deputy governors) are rows with `principal_candidate_id` set.

**`access_link`**: a token for candidate access.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| candidate_id | int | FK `candidate.id` (RESTRICT), not null |
| token_hash | varchar | unique, not null |
| expires_at | timestamptz | not null |
| is_revoked | boolean | `FALSE` |
| created_at | timestamptz | `NOW()` |

Schema only: no API route uses it yet.

#### Groups, access and agents

**`groups`**: an organisation or access group.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| group_name | varchar | not null |
| group_type | `group_type` | not null |
| parent_group_id | int | FK `groups.id` (SET NULL), nullable |
| created_at | timestamptz | `NOW()` |

**`membership`**: a person's membership in a group.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| person_id | uuid | FK `person.id` (CASCADE), not null |
| group_id | int | FK `groups.id` (CASCADE), not null |
| membership_role | varchar(50) | not null |
| updated_at | timestamptz | `NOW()` |

Unique `(person_id, group_id)`.

**`membership_scope_unit`**: the geographic or political scope of a membership.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | serial | PK |
| membership_id | int | FK `membership.id` (CASCADE), not null |
| scope_state_id | int | FK `state.id` (CASCADE), nullable |
| scope_lga_id | int | FK `lga.id` (CASCADE), nullable |
| scope_ward_id | int | FK `ward.id` (CASCADE), nullable |
| scope_political_unit_id | int | FK `political_unit.id` (CASCADE), nullable |
| created_at | timestamptz | `NOW()` |

Check: exactly one of the four scope columns is set.

**`group_visibility_grant`**: lets one group see another group's agents.

| Field | Type | Constraints / default |
| --- | --- | --- |
| viewer_group_id | int | PK part, FK `groups.id` (CASCADE) |
| owner_group_id | int | PK part, FK `groups.id` (CASCADE) |
| is_allowed | boolean | `TRUE` |

**`agent_assignment`**: assigns a person as an agent to a polling unit, for one owner.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| person_id | uuid | FK `person.id` (RESTRICT), not null |
| polling_unit_id | int | FK `polling_unit.id` (RESTRICT), not null |
| owner_group_id | int | FK `groups.id` (SET NULL), nullable |
| owner_candidate_id | int | FK `candidate.id` (SET NULL), nullable |
| agent_kind | `agent_kind` | not null |
| slot_number | smallint | `0`; official = 0, extra = 1 or more |
| created_at, updated_at | timestamptz | `NOW()` |

Checks: exactly one owner (group xor candidate). Partial unique index on `polling_unit_id` where `agent_kind = 'official'`.

#### Messaging

**`broadcast`**: an outbound message campaign.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| sender_person_id | uuid | FK `person.id` (RESTRICT), not null |
| audience_filter | jsonb | not null (IDs only) |
| message_text | text | not null |
| scheduled_send_at | timestamptz | nullable |
| broadcast_status | `broadcast_status` | `draft` (the API creates `scheduled` or `sending`) |
| created_at | timestamptz | `NOW()` |

**`delivery`**: one recipient's delivery of one broadcast.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| broadcast_id | uuid | FK `broadcast.id` (CASCADE), not null |
| person_id | uuid | FK `person.id` (RESTRICT), not null |
| delivery_channel | `delivery_channel` | not null |
| delivery_status | `delivery_status` | `pending` |
| sent_at, delivered_at, tapped_ok_at, failed_at | timestamptz | nullable |
| created_at | timestamptz | `NOW()` |

Unique `(broadcast_id, person_id)`.

#### Operations

**`audit_log`**: append-only audit events.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | bigserial | PK |
| actor_person_id | uuid | FK `person.id` (SET NULL), nullable |
| action_type | varchar | not null |
| target_entity_type, target_entity_id | varchar | nullable |
| ip_address | varchar | nullable |
| created_at | timestamptz | `NOW()` |

Indexes: `(actor_person_id, created_at)`, `(target_entity_type, target_entity_id)`. Trigger `audit_log_append_only` rejects `UPDATE` and `DELETE`.

**`import_batch`**: tracking for file imports.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| file_name | varchar | not null |
| uploader_person_id | uuid | FK `person.id` (RESTRICT), not null |
| total_row_count, imported_row_count, error_row_count | int | `0` |
| error_details | jsonb | nullable |
| created_at | timestamptz | `NOW()` |

Schema only: no import route exists yet.

**`coverage_count`**: a cache of coverage counts by scope and owner.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | bigserial | PK |
| unit_state_id | int | FK `state.id` (CASCADE), nullable |
| unit_lga_id | int | FK `lga.id` (CASCADE), nullable |
| unit_ward_id | int | FK `ward.id` (CASCADE), nullable |
| unit_political_unit_id | int | FK `political_unit.id` (CASCADE), nullable |
| owner_group_id | int | FK `groups.id` (CASCADE), nullable |
| owner_candidate_id | int | FK `candidate.id` (CASCADE), nullable |
| coverage_kind | `coverage_kind` | not null |
| covered_polling_unit_count, total_polling_unit_count | int | not null; covered ≤ total |
| refreshed_at | timestamptz | not null |

Check: exactly one unit scope is set. Unique over scope, owner and kind (`NULLS NOT DISTINCT`). Not read at runtime: coverage is computed live from `agent_assignment`.

#### Authentication

**`login_otp`**: a one-time login code (hash only).

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| person_id | uuid | FK `person.id` (CASCADE), not null |
| code_hash | varchar | not null |
| expires_at | timestamptz | not null |
| consumed_at | timestamptz | nullable |
| failed_attempt_count | integer | `0` |
| requested_from_ip | varchar | nullable |
| created_at | timestamptz | `NOW()` |

Index `(person_id, created_at)`.

**`auth_session`**: a signed-in session (token hash only).

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | uuid | PK |
| person_id | uuid | FK `person.id` (CASCADE), not null |
| session_token_hash | varchar | unique, not null |
| expires_at | timestamptz | not null |
| last_active_at | timestamptz | not null |
| revoked_at | timestamptz | nullable |
| created_from_ip | varchar | nullable |
| created_at | timestamptz | `NOW()` |

**`auth_rate_limit`**: fixed-window rate-limit buckets.

| Field | Type | Constraints / default |
| --- | --- | --- |
| id | bigserial | PK |
| bucket_key | varchar | not null (hashed email or IP key) |
| window_started_at | timestamptz | not null |
| hit_count | integer | `0` |

Unique `(bucket_key, window_started_at)`.

**pg-boss tables.** pg-boss creates and manages its own schema (`pgboss.*`) in the same database. It isn't part of the TypeORM migrations.

### 4.5 ERD

Only keys are shown to keep the diagram readable. Column details are in [Data models](#44-data-models).

```mermaid
erDiagram
  state ||--o{ lga : "has"
  lga ||--o{ ward : "has"
  ward ||--o{ polling_unit : "has"
  polling_unit ||--o{ pu_political_unit : "mapped by"
  political_unit ||--o{ pu_political_unit : "mapped by"
  political_unit |o--o{ political_unit : "parent of"

  polling_unit |o--o{ person : "home unit of"
  person ||--o{ phone_number : "has"
  person ||--o{ consent : "gives"
  person ||--o{ login_otp : "requests"
  person ||--o{ auth_session : "owns"
  person |o--o{ audit_log : "acts in"
  person ||--o{ import_batch : "uploads"

  groups |o--o{ groups : "parent of"
  groups ||--o{ membership : "has"
  person ||--o{ membership : "joins"
  membership ||--o{ membership_scope_unit : "limited by"
  state |o--o{ membership_scope_unit : "scope"
  lga |o--o{ membership_scope_unit : "scope"
  ward |o--o{ membership_scope_unit : "scope"
  political_unit |o--o{ membership_scope_unit : "scope"
  groups ||--o{ group_visibility_grant : "viewer"
  groups ||--o{ group_visibility_grant : "owner"

  office ||--o{ seat : "contested as"
  political_unit ||--o{ seat : "contains"
  person ||--o{ candidate : "is"
  seat |o--o{ candidate : "contested by"
  candidate |o--o{ candidate : "running mate of"
  candidate ||--o{ access_link : "has"

  election_day ||--o{ election_day_office : "contests"
  office ||--o{ election_day_office : "contested on"
  election_day ||--o{ election_day_off_cycle_state : "includes"
  state ||--o{ election_day_off_cycle_state : "votes off-cycle"

  person ||--o{ agent_assignment : "is agent"
  polling_unit ||--o{ agent_assignment : "covered by"
  groups |o--o{ agent_assignment : "owns"
  candidate |o--o{ agent_assignment : "owns"

  person ||--o{ broadcast : "sends"
  broadcast ||--o{ delivery : "produces"
  person ||--o{ delivery : "receives"

  state |o--o{ coverage_count : "unit"
  lga |o--o{ coverage_count : "unit"
  ward |o--o{ coverage_count : "unit"
  political_unit |o--o{ coverage_count : "unit"
  groups |o--o{ coverage_count : "owner"
  candidate |o--o{ coverage_count : "owner"

  state {
    int id PK
    string inec_state_code UK
  }
  lga {
    int id PK
    int state_id FK
  }
  ward {
    int id PK
    int lga_id FK
  }
  polling_unit {
    int id PK
    int ward_id FK
    string inec_polling_unit_code UK
  }
  political_unit {
    int id PK
    int parent_political_unit_id FK
  }
  pu_political_unit {
    int political_unit_id PK, FK
    int polling_unit_id PK, FK
  }
  person {
    uuid id PK
    int home_polling_unit_id FK
    string email_address UK
  }
  phone_number {
    uuid id PK
    uuid person_id FK
    string e164_number UK
    bigint telegram_chat_id UK
  }
  consent {
    uuid id PK
    uuid person_id FK
  }
  login_otp {
    uuid id PK
    uuid person_id FK
  }
  auth_session {
    uuid id PK
    uuid person_id FK
    string session_token_hash UK
  }
  auth_rate_limit {
    bigint id PK
    string bucket_key UK
  }
  audit_log {
    bigint id PK
    uuid actor_person_id FK
  }
  import_batch {
    uuid id PK
    uuid uploader_person_id FK
  }
  groups {
    int id PK
    int parent_group_id FK
  }
  membership {
    int id PK
    uuid person_id FK
    int group_id FK
  }
  membership_scope_unit {
    int id PK
    int membership_id FK
    int scope_state_id FK
    int scope_lga_id FK
    int scope_ward_id FK
    int scope_political_unit_id FK
  }
  group_visibility_grant {
    int viewer_group_id PK, FK
    int owner_group_id PK, FK
  }
  office {
    int id PK
    string office_name UK
  }
  seat {
    int id PK
    int office_id FK
    int political_unit_id FK
  }
  candidate {
    int id PK
    uuid person_id FK
    int seat_id FK
    int principal_candidate_id FK
  }
  access_link {
    uuid id PK
    int candidate_id FK
    string token_hash UK
  }
  election_day {
    int id PK
    date election_date UK
  }
  election_day_office {
    int election_day_id PK, FK
    int office_id PK, FK
  }
  election_day_off_cycle_state {
    int election_day_id PK, FK
    int state_id PK, FK
  }
  agent_assignment {
    uuid id PK
    uuid person_id FK
    int polling_unit_id FK
    int owner_group_id FK
    int owner_candidate_id FK
  }
  broadcast {
    uuid id PK
    uuid sender_person_id FK
  }
  delivery {
    uuid id PK
    uuid broadcast_id FK
    uuid person_id FK
  }
  coverage_count {
    bigint id PK
    int unit_state_id FK
    int unit_lga_id FK
    int unit_ward_id FK
    int unit_political_unit_id FK
    int owner_group_id FK
    int owner_candidate_id FK
  }
```

### 4.6 Endpoints

The full contract (parameters, bodies, response schemas, examples, error responses) is in [`public/openapi.yaml`](./public/openapi.yaml). Run the app and open **[Swagger UI at `/api/docs`](http://localhost:3000/api/docs)**; the raw spec is at [`/api/openapi`](http://localhost:3000/api/openapi).

"Session" means the session cookie. Mutating routes also need a matching `Origin` header.

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | None | Check the app can reach Postgres |
| `POST /api/auth/otp/request` | None | Email a sign-in code |
| `POST /api/auth/otp/verify` | None | Verify a code and create a session |
| `GET /api/auth/session` | Cookie (optional) | Current session and person, or `authenticated: false` |
| `POST /api/auth/logout` | Cookie (optional) | Delete the session and clear the cookie |
| `GET /api/auth/permissions` | Session | Roles and permission flags |
| `GET /api/agents` | Session | List visible agents (filters, search, cursor) |
| `GET /api/agents/summary` | Session | Counts by role and Telegram readiness |
| `POST /api/broadcasts/preview` | Session, same origin | Count the official and extra agents a filter reaches |
| `GET /api/broadcasts` | Session | List visible broadcasts |
| `POST /api/broadcasts` | Session, same origin | Create and queue a broadcast (`201`) |
| `GET /api/broadcasts/{id}` | Session | Broadcast detail with delivery counts |
| `GET /api/broadcasts/{id}/deliveries` | Session | Deliveries with masked phones (audited) |
| `GET /api/geography/states` | Session | Accessible states with coverage counts |
| `GET /api/geography/states/{stateId}` | Session | One state's counts |
| `GET /api/geography/states/{stateId}/lgas` | Session | LGAs in a state with counts |
| `GET /api/geography/lgas/{lgaId}/wards` | Session | Wards in an LGA with counts |
| `GET /api/geography/wards/{wardId}/polling-units` | Session | Polling units and their agents (cursor, audited) |
| `GET /api/coverage/summary` | Session | Coverage totals for the filtered area |
| `GET /api/coverage/map-points` | Session | Grouped polling-unit coordinates and official-agent counts (no person data) |
| `GET /api/coverage/candidates` | Session | Candidates with coverage for their seat (cursor, `limit` up to 500, audited) |
| `GET /api/coverage/gaps` | Session | Polling units without an official agent (offset) |
| `POST /api/coverage/assignments` | Session, same origin | Create an agent assignment (audited) |
| `DELETE /api/coverage/assignments/{assignmentId}` | Session, same origin | Delete an assignment (audited) |
| `GET /api/admin/queue` | Session, admin | Queue counts and recent jobs |
| `POST /api/telegram/webhook` | Telegram secret header | Receive bot updates |
| `GET, POST /api/dev/queue-test` | None, dev only | Inspect or enqueue test jobs; `404` in production |
| `GET /api/openapi` | None | OpenAPI YAML |
| `GET /api/docs` | None | Swagger UI |

---

## 5. Worker

A standalone Node process (`worker/index.ts`, run with `tsx`) that consumes pg-boss jobs. It opens no HTTP port.

### Tech stack and why

| Piece | Why |
| --- | --- |
| pg-boss 12 | Queue in the existing Postgres: durable, retries with backoff, scheduling, de-duplication |
| TypeORM `DataSource` (`worker/lib/database.ts`) | Same entities as the API |
| grammY | Telegram sends |
| Brevo SMS channel | Fallback channel behind an interface |
| `tsx` | Runs TypeScript directly, so no separate build step |

The worker must never import `lib/db/index.ts` or `lib/queue/index.ts`. They import `server-only`, which throws outside Next.js. It only uses files that are free of it (`lib/db/data-source.ts`, `lib/queue/names.ts`, `worker/jobs/*`, channels).

### Queue and job flow

```mermaid
flowchart TD
  A["POST /api/broadcasts"] --> B["Transaction: insert broadcast<br/>(status sending or scheduled) + audit_log"]
  B --> C["enqueue broadcast-resolve<br/>singletonKey = broadcastId<br/>startAfter = scheduledSendAt (if scheduled)"]
  C --> D["worker: broadcast-resolve"]
  D --> E{"Broadcast still<br/>scheduled or sending?"}
  E -- "no" --> Z1["skip"]
  E -- "yes" --> F["Transaction: status = sending,<br/>materializeDeliveries() -> delivery rows"]
  F --> G{"Any recipients?"}
  G -- "none" --> Z2["status = completed"]
  G -- "yes" --> H["insert delivery-send jobs<br/>batches of 500, singletonKey = deliveryId"]
  H --> I["worker: delivery-send (batchSize 1)"]
  I --> J{"Delivery terminal or<br/>broadcast cancelled?"}
  J -- "yes" --> Z3["skip"]
  J -- "no" --> K["status = sent"]
  K --> L{"Confirmed phone with chat id<br/>AND accepted consent?"}
  L -- "no" --> S["SMS fallback"]
  L -- "yes" --> M["wait for Telegram token bucket"]
  M --> N{"Consent declined?"}
  N -- "yes" --> X["delivery = failed"]
  N -- "no" --> O["Telegram sendMessage<br/>with OK button"]
  O -- "ok" --> P["delivery = delivered"]
  O -- "429" --> Q["pause bucket, throw -> pg-boss retry"]
  O -- "transient error" --> R{"Retries left?"}
  R -- "yes" --> Q
  R -- "no" --> S
  O -- "blocked chat / permanent" --> S
  S --> T{"Confirmed phone and<br/>no decline?"}
  T -- "no" --> X
  T -- "yes" --> U["SMS send"]
  U -- "ok" --> V["delivery = delivered_by_sms"]
  U -- "error / not configured" --> X
  P --> W["completeBroadcastIfFinished"]
  V --> W
  X --> W
  W --> Y["No pending or sent deliveries left?<br/>completed if any non-failed, else failed"]
```

### Queues and job types

| Queue | Payload | Handler | What it does |
| --- | --- | --- | --- |
| `broadcast-resolve` | `{ broadcastId }` | `worker/jobs/broadcast-resolve.ts` | Turns the audience into `delivery` rows and enqueues `delivery-send` jobs |
| `delivery-send` | `{ deliveryId }` | `worker/jobs/delivery-send.ts` | Sends one delivery via Telegram, with SMS fallback (`batchSize: 1`) |
| `test-job` | `{ n, fail }` | `worker/jobs/test-job.ts` | Smoke test for ops (dev route enqueues it) |

Names live in `lib/queue/names.ts` so the API and the worker can't drift. Payloads carry opaque IDs only: no names, phones or other personal data.

### Retries and failure handling

| Setting | Value |
| --- | --- |
| `retryLimit` | 5 |
| `retryDelay` | 10 seconds |
| `retryBackoff` | `true` (exponential) |
| Dedupe | `singletonKey` = broadcast ID or delivery ID |
| Telegram `429` | The shared limiter pauses for `retry_after`, and the job is retried |
| Transient Telegram error | Retried; after the last retry it falls back to SMS |
| Blocked chat or permanent Telegram error | Falls back to SMS immediately |
| No confirmed phone, or declined consent | Delivery is marked `failed` |
| Idempotency | `delivery-send` exits if the delivery is already terminal or the broadcast is cancelled |
| Graceful shutdown | On `SIGTERM`, `SIGINT` (and `SIGBREAK` on Windows) it stops fetching and drains in-flight jobs for up to 15 s |
| Pool sizes | Worker pool `max: 10`; the API's queue producer pool `max: 3` |

### Scheduling

- **Scheduled broadcasts** use pg-boss `startAfter` on the `broadcast-resolve` job. The API accepts a time up to 90 days ahead.
- There are no recurring (cron) jobs.

### How the worker talks to the rest of the system

- **Database:** reads and writes `broadcast`, `delivery`, `phone_number` and `consent` directly, and the pg-boss tables. It uses `QUEUE_DATABASE_URL` when set (pg-boss needs a direct, non-pooled connection for advisory locks), otherwise `DATABASE_URL`.
- **API:** it never calls it. The API enqueues; the worker consumes.
- **Telegram:** one shared token bucket (`TELEGRAM_MAX_PER_SECOND`, default 25) per process, so **run exactly one worker instance**.
- **Brevo:** SMS fallback when `SMS_PROVIDER=brevo`.
- Set `TELEGRAM_DRY_RUN=true` to skip real Telegram sends in development. Never set it in production.

### Telegram bot (runs in the Next.js app, not the worker)

`POST /api/telegram/webhook` is verified with the `X-Telegram-Bot-Api-Secret-Token` header (`TELEGRAM_WEBHOOK_SECRET`).

- `/start` sends the share-number or consent prompt as needed.
- Sharing a contact links the chat to an existing phone number. Only the sender's own contact is accepted; forwarded contacts and group chats are ignored. A conflicting chat writes an audit event and changes nothing. An unknown number gets a "not registered" reply.
- After linking, the bot asks for consent to the versioned text (`PRIVACY_POLICY_URL` is shown when set). A decline excludes the person from future broadcasts.
- An "OK" button tap on a delivery sets `tapped_ok`, only from the linked chat.

---

## 6. Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Name | Description | Required | Example |
| --- | --- | --- | --- |
| `DATABASE_URL` | Postgres connection string (API, worker, migrations, seeds). On Neon the pooled URL is fine here | Yes | `postgresql://user:pass@host:5432/db` |
| `QUEUE_DATABASE_URL` | Direct (non-pooler) connection string for pg-boss. Falls back to `DATABASE_URL`. On Neon, remove `-pooler` from the host | Recommended on Neon | `postgresql://user:pass@host-direct:5432/db` |
| `DATABASE_SSL` | `true` enables SSL (`rejectUnauthorized: false`) | Optional (default off) | `true` |
| `NODE_ENV` | `production` switches the cookie name, disables `/api/dev/*`, the console OTP sender and demo seeding | Optional | `production` |
| `AUTH_SECRET` | Key for OTP hashing; at least 32 characters | Yes (API) | `a-long-random-string-of-32+-chars` |
| `OTP_DELIVERY` | `brevo` or `console`. Defaults to `brevo` when `BREVO_API_KEY` is set, otherwise `console` (code printed in the server log; refused in production) | Optional | `console` |
| `BREVO_API_KEY` | Brevo key for OTP email and SMS | Yes in production | `xkeysib-...` |
| `BREVO_FROM_EMAIL` | OTP sender address | Optional | `no-reply@example.com` |
| `BREVO_FROM_NAME` | OTP sender name (default `Collate`) | Optional | `Collate` |
| `TRUST_PROXY` | `true` trusts `X-Forwarded-For` for client IPs. Default `false`. Only enable behind a trusted proxy | Optional | `true` |
| `SERVER_BASE_URL` | Public base URL, used as the Swagger server URL | Optional (default `/`) | `https://collate.example.com` |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | Yes (API and worker) | `123456:ABC...` |
| `TELEGRAM_BOT_USERNAME` | Bot username | Yes (API and worker) | `collate_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Secret sent by Telegram in the webhook header | Yes (API and worker) | `random-string` |
| `TELEGRAM_MAX_PER_SECOND` | Send rate cap (default 25) | Optional | `25` |
| `TELEGRAM_DRY_RUN` | `true` skips real Telegram sends. Never in production | Optional | `false` |
| `PRIVACY_POLICY_URL` | Link shown in the consent message | Optional | `https://example.com/privacy` |
| `SMS_PROVIDER` | `none` (default) or `brevo` | Optional | `brevo` |
| `BREVO_SMS_SENDER` | SMS sender name (default `Collate`) | Optional | `Collate` |
| `ALLOW_DEMO_SEED` | Must be `true` to run the demo seed. It never runs in production | Optional | `true` |
| `RUN_DB_TESTS` | `true` enables the database integration tests | Optional | `true` |

**Worker only** needs: `DATABASE_URL`, `QUEUE_DATABASE_URL`, `DATABASE_SSL`, the three `TELEGRAM_*` credentials, `TELEGRAM_MAX_PER_SECOND`, and (if SMS fallback is wanted) `SMS_PROVIDER`, `BREVO_API_KEY`, `BREVO_SMS_SENDER`.

---

## 7. Getting started

### Prerequisites

- Node.js 20 or newer (the type definitions target Node 20; the repo doesn't pin an engine)
- npm
- A PostgreSQL database (a local one or a Neon project)
- Optional: a Telegram bot from [@BotFather](https://t.me/BotFather), a Brevo account, and a tunnel (ngrok or cloudflared) for webhook testing

### Install and configure

```sh
git clone https://github.com/Collate-Africa/collate.git
cd collate
npm install
cp .env.example .env     # then fill in DATABASE_URL, AUTH_SECRET, Telegram values
```

### Migrations and seeding

```sh
npm run db:migrate                 # apply all migrations
npm run db:seed                    # offices and group visibility grants
npm run db:seed:inec               # real INEC geography (idempotent)
npm run db:seed:inec:coordinates   # dry-run coordinate match report
npm run db:seed:inec:politics      # political units, seats, NDC candidates (run after db:seed:inec)
```

The coordinate command downloads the MIT-licensed [INEC polling-unit dataset](https://github.com/mykeels/inec-polling-units) (at a pinned revision; originally sourced from INEC), then matches on normalized state, LGA, ward and polling-unit names. It skips missing or out-of-envelope points, duplicate or ambiguous name matches, and existing coordinates. The source has no polling-unit codes, so matching is deliberately exact and incomplete. In the pinned snapshot, 57,326 rows have no coordinates, 1,505 points are outside the coarse envelope, and more than 92,000 valid rows share a coordinate with another unit. That can mean several units share a site, but it can also mean a geocoding shortcut; these are approximate data, not verified survey locations. The default is a dry run; pass `-- --apply` to update only rows whose latitude and longitude are both NULL:

```sh
npm run db:seed:inec:coordinates -- --apply
```

The source geocodes by name, so some units landed on a same-named place elsewhere (often in a different state). The importer therefore also checks each point against [geoBoundaries](https://www.geoboundaries.org/) (CC BY 4.0, pinned revision, 2022) state and LGA polygons and rejects a point that is more than 2 km outside its own state or more than 25 km outside its own LGA. LGAs whose names do not match a boundary are checked at state level only. In the pinned snapshot this removed 9,131 of 102,154 points (2,040 outside their state, 7,091 far from their LGA). Points inside the tolerance can still be a few kilometres off. To audit what is already stored, run a dry run, then clear the invalid points (a CSV backup of the cleared rows is written to the temp folder, or pass `--backup=<file.csv>`):

```sh
npm run db:audit:coordinates
npm run db:audit:coordinates -- --apply
```

| Script | Purpose |
| --- | --- |
| `npm run db:migrate:revert` | Revert the last migration |
| `npm run db:migrate:generate` | Generate a migration from entity changes |
| `npm run db:migrate:create` | Create an empty migration |
| `npm run db:seed:demo` | Fake demo data (needs `ALLOW_DEMO_SEED=true`; refuses production) |
| `npm run db:seed:demo:reset` | Delete demo data |
| `npm run db:seed:demo:fresh` | Reset, then seed demo data |

Real INEC data: `data/inec/*.json.gz` is committed. `npx tsx scripts/inec-scrape.ts` rebuilds the geography file, and `python scripts/inec-extract-candidates.py` and `python scripts/inec-build-political-units.py` rebuild the candidate and political-unit files (they need `pip install pymupdf`). The seeds load 37 states, 774 LGAs, 8,838 wards, 177,299 polling units, 1,488 political units, 1,487 seats and 1,420 candidates.

### Run it

```sh
npm run dev            # frontend + API on http://localhost:3000
npm run worker         # in a second terminal: the queue worker
npm run worker:dev     # same, with restart on change
```

1. Open `http://localhost:3000/api/health`, then `/api/docs`.
2. Sign in at `/login`. With `OTP_DELIVERY=console` the code is printed in the `npm run dev` terminal. The email must belong to an existing person with a membership or candidate row.
3. For Telegram: expose the app with a tunnel, then:

```sh
npm run telegram:check                                              # verify the bot token
npm run telegram:webhook:set -- https://<tunnel-url>/api/telegram/webhook
npm run telegram:webhook:delete                                     # remove the webhook
```

A bot can have only one webhook, and a tunnel URL changes on restart, so set it again each time.

### Docker

There is no Docker or docker-compose file in the repo. See [Notes / TODO](#11-notes--todo).

---

## 8. Testing, deployment and contributing

### Testing

```sh
npm test              # vitest run (unit tests)
npm run lint          # eslint
npm run build         # next build
```

```sh
npm run typecheck     # tsc --noEmit
npm run test:db       # unit tests + database integration tests (needs a throwaway DATABASE_URL)
npm run db:seed:test  # empties the test database and loads the test-script fixture
npm run test:scope    # who-can-see-what tests against real routes (empties the database)
npm run test:e2e      # Playwright browser tests (seeds the fixture, starts `next dev`)
```

All of these run in CI (`.github/workflows/ci.yml`) on every pull request, against a fresh Postgres.

**Use a separate database for tests.** `db:seed:test`, `test:scope` and `test:e2e` empty every
table first. They refuse to run when `NODE_ENV=production` or when the database name does not
contain `test`. Locally: `createdb collate_test`, point `DATABASE_URL` at it, `npm run db:migrate`.

**The test fixture** (`lib/db/seeds/test/fixture.ts`) is the "Personas" and "Fixture data" tabs of
the manual test script: 26 personas and 8 polling units with known coverage figures. Scope and
browser test names start with the test ID from that sheet (e.g. `COV-07`), so a failure points at
the same row a tester would run by hand. Tests marked `it.fails` / `test.fail()` are known gaps
between the app and the spec; remove the marker when the gap is fixed.

- Unit tests sit next to the code (`*.test.ts`): auth, policy, channels, queue decisions, worker jobs, hooks.
- `lib/policy/route-imports.test.ts` fails if a route imports `lib/db`, `typeorm` or `pg`.
- Database integration tests (`lib/policy/core/policy.db.test.ts`, `lib/broadcast/broadcast.db.test.ts`) are skipped unless `RUN_DB_TESTS=true` and `DATABASE_URL` is set. They write to the database, so point them at a throwaway one, never production.

### Deployment

| Part | Where | How |
| --- | --- | --- |
| Next.js app (frontend + API + Telegram webhook) | Vercel | Standard Next.js build. Set the API env vars. Run `npm run db:migrate` against the production database before or with a release |
| Worker | Render **Background Worker** | Build `npm ci`, start `npm run worker`, **one instance only** (the Telegram limiter is per process). Set the worker env vars |
| Database | Neon Postgres | Use the pooled URL for `DATABASE_URL` and the direct URL for `QUEUE_DATABASE_URL`; `DATABASE_SSL=true` |
| Telegram webhook | Telegram | After deploying, run `npm run telegram:webhook:set -- https://<domain>/api/telegram/webhook`. Re-run it after rotating the bot token |

Production checklist: `NODE_ENV=production`, strong `AUTH_SECRET`, `TELEGRAM_DRY_RUN` unset, `OTP_DELIVERY` not `console`, `TRUST_PROXY=true` only behind a trusted proxy, and `SERVER_BASE_URL` set to the public URL.

### Contributing

1. Branch from the main branch and keep changes small and focused.
2. Routes call `lib/` functions. Don't import `lib/db`, `typeorm` or `pg` in a route.
3. Use `success()`, `failure()` and `internalError()` from `lib/api/response.ts`. Don't use raw `Response.json`.
4. Mask phone numbers, cap `limit` (100 for most lists, 500 for `/api/coverage/candidates` and `/api/coverage/gaps`) with cursor pagination where the list supports it, and check same origin on mutating routes.
5. A route that returns individual person data writes an `audit_log` row in the same transaction.
6. Never put names, phones or other personal data in queue payloads or logs.
7. Don't hardcode state, LGA, ward, office or group names, or INEC codes.
8. For every route change, update `public/openapi.yaml` and `types/api.ts`.
9. Schema changes need a migration (`synchronize` stays off).
10. This repo uses a newer Next.js than most docs cover. Check `node_modules/next/dist/docs/` before writing Next-specific code.
11. Before opening a PR: `npm run lint`, `npm run build` and `npm test`.

---

## 9. License and contact

- **License:** none yet (there is no `LICENSE` file). All rights reserved until the owners choose one.
- **Contact:** repository [Collate-Africa/collate](https://github.com/Collate-Africa/collate). Open an issue there. No maintainer contact is listed in the repo.

---

## 10. Data sources and attribution

Everything below is third-party data or a third-party service. The repo does not own any of it.

| Data | Source | Used for | Licence / terms |
| --- | --- | --- | --- |
| States, LGAs, wards, polling units | [INEC polling unit locator](https://cvr.inecnigeria.org/pu), scraped by `scripts/inec-scrape.ts` into `data/inec/geography.json.gz` | The whole geography tree | INEC public data. No licence is stated by INEC. |
| Candidate lists (presidential, governorship, Senate, House of Representatives, state assembly) | Final candidate list PDFs from the [INEC press page](https://www.inecnigeria.org/press), parsed by `scripts/inec-extract-candidates.py` into `data/inec/candidates.json.gz` | Candidates and seats | INEC public documents |
| Federal constituency names | [Wikipedia: List of Nigerian federal constituencies](https://en.wikipedia.org/wiki/List_of_Nigerian_federal_constituencies) (wikitext saved in `data/inec/sources/wiki-federal.txt`, as at November 2024) | Mapping constituencies to LGAs in `scripts/inec-build-political-units.py` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Polling-unit coordinates | [mykeels/inec-polling-units](https://github.com/mykeels/inec-polling-units), `polling-units.csv` at commit `cea8b041`, itself derived from INEC | `polling_unit.latitude` / `longitude` via `npm run db:seed:inec:coordinates` | MIT (per the repo). Geocoded by name, so approximate. |
| State and LGA boundaries | [geoBoundaries](https://www.geoboundaries.org/) Nigeria ADM1 and ADM2, gbOpen release, commit `9469f09`, boundary year 2022 | Checking coordinates against their own state and LGA (`lib/db/seeds/inec-coordinate-validation.ts`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Cite: Runfola, D. et al. (2020), "geoBoundaries: A global database of political administrative boundaries", PLOS ONE 15(4): e0231866. |
| Map tiles | [OpenStreetMap](https://www.openstreetmap.org/copyright) raster tiles (`tile.openstreetmap.org`) | Coverage map base layer | ODbL. Attribution is shown on the map. The public tile server has a [usage policy](https://operations.osmfoundation.org/policies/tiles/); use a tile provider for heavy production traffic. |
| Map fonts | MapLibre demo glyphs (`demotiles.maplibre.org`, "Noto Sans Regular") | Cluster count labels | Demo service, not for production use |

How the coordinate data was cleaned:

1. The coordinate importer matched 102,154 INEC polling units to the MIT dataset by exact normalised state, LGA, ward and unit name, and wrote them to `polling_unit`.
2. Some points were geocoded to a same-named place elsewhere, so units showed up in the wrong state. We checked every stored point against the geoBoundaries state and LGA polygons.
3. 9,131 points failed (2,040 more than 2 km outside their own state, 7,091 more than 25 km outside their own LGA) and were set to `NULL`. 93,023 remain. The importer now applies the same check, so re-running it does not bring them back.

Caveats: INEC's own pages and PDFs may change after scraping; the committed files are a snapshot. Boundary polygons are generalised, which is why the state check allows 2 km. If you reuse this data, keep the CC BY and ODbL attributions.

---

## 11. Notes / TODO

Things that are unclear, missing or worth fixing. Nothing here is guessed in the sections above.

**Missing from the repo**

- [ ] No `LICENSE` file and no maintainer contact.
- [ ] No Dockerfile or docker-compose file, and no CI config (`.github`).
- [ ] No Node version pin (`engines` or `.nvmrc`). The README says Node 20+ because `@types/node` is `^20`.
- [ ] No `middleware`/`proxy` file: unauthenticated page access is handled client-side by redirecting to `/login` on a `401`.

**Frontend**

- [ ] `AppProvider` (`lib/context/app-context.tsx`) still imports static data from `lib/data/broadcasts-data.ts` and `lib/data/settings-data.ts`. The Settings page and its security, privacy and channel panels read `lib/data/settings-data.ts` (static access groups, audit log, access links, channel config). `lib/data/available-agents-pool.ts` feeds the agent autocomplete. These aren't live API data.
- [ ] `/api/auth/session` returns `candidateId: null` always.

**API**

- [ ] `docs/backend-system-design.md` is partly out of date (it says only `test-job` has a worker handler and lists the older route set). Update or remove it.
- [ ] OTP request returns `404` for unknown or ineligible emails, which allows email enumeration (invite-only system, rate-limited). `OTP_REQUEST_MIN_RESPONSE_MS` and `OTP_REQUEST_COOLDOWN_MS` are declared in `lib/auth/config.ts` but not applied.
- [ ] OTP routes have no `Origin` check. They rely on `SameSite=Lax`.
- [ ] Rate limits are fixed-window, so a burst across a window edge can briefly double the allowance. With `TRUST_PROXY=false` behind a proxy, all clients share one IP bucket.
- [ ] `/api/coverage/gaps` uses offset pagination with `limit` up to 500, unlike most lists (cursor, max 100). `/api/coverage/candidates` is cursor-paginated but also allows up to 500, so the Candidates page loads the whole registry in two requests.
- [ ] Polling-unit coordinates: about 84,000 of 177,299 units have none (about 57,000 missing in the source plus 9,131 cleared by the boundary check). 40 LGA names (for example Sagamu, Somolu, Maiduguri M.C.) don't match the geoBoundaries names, so those are checked at state level only. Points that pass can still be a few kilometres off, and no source gives surveyed locations.
- [ ] `coverage_count` is never read; coverage is computed live from `agent_assignment`.
- [ ] Coverage credit: a candidate's coverage currently counts only official agents owned by that candidate. Decide whether any official agent in the seat should count.
- [ ] The office-overlap "tree rule" is a TODO in the policy layer.
- [ ] INEC publishes no constituency-to-polling-unit mapping, so `pu_political_unit` is derived at LGA level from constituency names (`scripts/inec-build-political-units.py`). A constituency whose LGAs can't be determined exactly has a `seat` but no mapped polling units, so its candidate sees none.
- [ ] `access_link` and `import_batch` have tables but no API routes. There are also no routes for broadcast cancellation, INEC or agent import, or admin group/user management.
- [ ] `/api/geography/*` and `/api/coverage/*` (except where noted) use `requireApiAuth` with SQL in the route files, whereas agents and broadcasts go through `lib/policy`. The route-imports test only covers the policy-managed routes.
- [ ] The OpenAPI `CandidateCoverage.channelStatus` still lists `sms_only` and `not_matched`. Check it against the current candidate coverage code if SMS is dropped from the UI.
- [ ] Validation errors are always `400`; `422` is never returned.

**Worker**

- [ ] Enqueue happens after the broadcast transaction commits. If the process dies in between, a `sending` broadcast has no job. Enqueue inside the transaction or add a sweeper.
- [ ] The Telegram rate limiter is per process, so only one worker instance is safe.
- [ ] SMS fallback re-checks a decline but not a missing consent row. `TODO(decision)` in `worker/jobs/delivery-send.ts`: this needs a product and legal decision (NDPA).
- [ ] If retries are exhausted after a delivery was marked `sent`, it can stay non-terminal. A reconciliation job for stale `sent` rows would fix it.
- [ ] `lib/channels/telegram/consent-text.ts` is still `v0-draft`.

**Security follow-ups**

- [ ] Rotate any database password, bot token and webhook secret that has ever been pasted into a chat, log or ticket, then re-run `npm run telegram:webhook:set`.
