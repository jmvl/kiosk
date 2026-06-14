# Admin authentication decision

Status: proposed implementation decision, not yet implemented
Date: 2026-06-13
Scope: admin/operator authentication for the retail kiosk activation platform

## Decision summary

Implement real admin authentication in the central control plane first, backed by a durable database. The deployed kiosk-local admin placeholder at `/admin` must remain explicitly non-production until it delegates login/session validation to database-backed auth.

Recommended path:

1. Use `CENTRAL_DATABASE_URL` for the central PostgreSQL database as the production source of truth for users, roles, sessions, and audit records.
2. Accept `DATABASE_URL` as a generic alias only when a service has a single database target; central service startup should prefer `CENTRAL_DATABASE_URL` when both are present.
3. For local/HQ offline development only, allow a SQLite fallback at `AUTH_SQLITE_PATH` or `LOCAL_AUTH_SQLITE_PATH`, but mark that mode as `AUTH_MODE=local-dev` and never claim production authentication from it.
4. Store password hashes with Argon2id, issue opaque database-backed session tokens in `HttpOnly; Secure; SameSite=Lax` cookies, and audit every login/admin action.
5. Protect all admin UI/API/control routes by default; keep `/health`/`/healthz` public and make kiosk/player runtime endpoints use separate kiosk/service credentials, not human admin cookies.

## Minimum credentials and environment variables

Required for production central admin auth:

| Variable | Required | Owner | Purpose |
|---|---:|---|---|
| `CENTRAL_DATABASE_URL` | yes | central-api | PostgreSQL connection string for central data plus auth tables. Preferred over generic `DATABASE_URL`. |
| `DATABASE_URL` | conditional | central-api | Generic fallback when `CENTRAL_DATABASE_URL` is unset. Do not use if local and central DBs are both configured in the same process. |
| `AUTH_SESSION_SECRET` | yes | central-api | 32+ bytes random secret used to HMAC/pepper opaque session cookie material or derive cookie signatures. Rotate with dual-key support. |
| `AUTH_COOKIE_NAME` | no | central-api | Default `rk_admin_session`. |
| `AUTH_COOKIE_DOMAIN` | production | central-api/proxy | Explicit domain for hosted admin console; omit for local host-only cookies. |
| `AUTH_COOKIE_SECURE` | production | central-api/proxy | Must be `true` behind HTTPS. Local dev can set `false` only for `localhost`/HQ LAN smoke tests. |
| `AUTH_SESSION_TTL_MINUTES` | no | central-api | Default 480 minutes; shorter for superadmin if needed later. |
| `AUTH_ARGON2_MEMORY_KIB` | no | central-api | Default 65536 KiB; tune only after deployment sizing. |
| `AUTH_ARGON2_TIME_COST` | no | central-api | Default 3. |
| `AUTH_ARGON2_PARALLELISM` | no | central-api | Default 1 or 2 depending CPU budget. |
| `AUTH_SQLITE_PATH` / `LOCAL_AUTH_SQLITE_PATH` | local-dev only | local-backend/admin dev | Optional SQLite fallback for isolated HQ development when central PostgreSQL is unavailable. Not production. |

Existing variables with related but separate scope:

- `LOCAL_BACKEND_AUTH_TOKEN` currently protects local runtime API access with a shared bearer token. Keep it as a kiosk/service control token; do not treat it as human admin auth.
- `LOCAL_BACKEND_ENABLE_DEV_ROUTES=true` exposes fake token/print controls. After auth lands, these routes must also require an admin session with an appropriate role, and should still remain HQ-only.
- `TICKET_SIGNING_SECRET` signs customer/staff ticket codes. Do not reuse it for auth sessions.

## Database tables

Add central auth tables through Drizzle migrations beside the existing central schema. Current `services/central-api/src/db/schema.ts` already has `locations`, `kiosks`, `heartbeats`, `sessions`, `events`, `tickets`, `device_commands`, `command_results`, and `audit_log`; auth should extend this schema rather than introduce a second production store.

Minimum tables:

### `admin_users`

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid primary key | Stable internal identifier. |
| `email` | text unique not null | Lowercase normalized; use as login identifier. |
| `display_name` | text | Human-readable operator name. |
| `password_hash` | text not null | Argon2id encoded hash string, including params/salt. |
| `password_updated_at` | timestamptz not null | Required for invalidating old sessions after reset. |
| `status` | varchar | `active`, `disabled`, `invited`, `locked`. |
| `mfa_required` | boolean default false | Schema-ready; MFA can be a later feature. |
| `last_login_at` | timestamptz nullable | Informational; do not use as security proof. |
| `created_at` / `updated_at` | timestamptz | Standard timestamps. |

### `admin_roles` and `admin_user_roles`

Roles can be seeded as rows or represented as an enum plus join table. Use a join table so future per-location/kiosk scoping is possible.

| Table | Key columns | Notes |
|---|---|---|
| `admin_roles` | `role_id`, `role_name`, `description` | Seed `viewer`, `operator`, `admin`, `superadmin`. |
| `admin_user_roles` | `user_id`, `role_id`, `scope_type`, `scope_id` | Composite unique key. `scope_type` initially `global`, later `location`/`kiosk`. |

### `admin_sessions`

| Column | Type | Notes |
|---|---|---|
| `session_id` | uuid primary key | Public database session id; not sufficient for auth alone. |
| `user_id` | uuid FK | Owner. |
| `token_hash` | text unique not null | SHA-256/HMAC hash of random opaque token; never store raw cookie token. |
| `created_at` | timestamptz not null | Session creation. |
| `expires_at` | timestamptz not null | Absolute expiry. |
| `last_seen_at` | timestamptz nullable | Update with rate limiting to avoid write amplification. |
| `revoked_at` | timestamptz nullable | Logout/admin revoke. |
| `ip_hash` | text nullable | Optional privacy-preserving diagnostic. |
| `user_agent` | text nullable | Diagnostic; truncate. |

Cookie value should be opaque, e.g. `rk1.<session_id>.<token>`. The server looks up `session_id`, hashes/verifies `token`, confirms user active, checks `expires_at`/`revoked_at`, and loads roles.

### `admin_audit_log`

The existing central `audit_log` table may be reused if it gains actor linkage, or a dedicated `admin_audit_log` can be added for stronger querying. Minimum fields:

| Column | Type | Notes |
|---|---|---|
| `audit_id` | uuid primary key | Event id. |
| `actor_user_id` | uuid nullable | Null for system/bootstrap actions. |
| `actor_email` | text nullable | Snapshot for forensics after email change. |
| `action` | text not null | `login_success`, `login_failed`, `logout`, `role_changed`, `command_issued`, etc. |
| `subject_type` / `subject_id` | text | Target user/kiosk/schedule/command/session. |
| `occurred_at` | timestamptz not null | Server time. |
| `request_id` | text nullable | Correlate with logs. |
| `ip_hash` / `user_agent` | text nullable | Minimal diagnostics. |
| `metadata` | jsonb not null default `{}` | Never include plaintext passwords/tokens. |

## Password and session approach

- Hash passwords with Argon2id using `@node-rs/argon2`, `argon2`, or another maintained Node binding. Persist the full encoded hash, not separate salt columns.
- Enforce minimum password policy on set/reset: 12+ chars and block obvious/common values; do not overfit composition rules.
- Login flow:
  1. Normalize email and fetch active user.
  2. Verify Argon2id hash in constant-time library path.
  3. On success, generate at least 32 random bytes for the opaque token.
  4. Store only token hash plus metadata in `admin_sessions`.
  5. Set cookie: `HttpOnly`, `Secure` in production, `SameSite=Lax`, path `/`, TTL aligned with `expires_at`.
  6. Audit success/failure without storing attempted password.
- Logout revokes current `admin_sessions` row and clears cookie.
- Password reset/change updates `password_updated_at` and revokes existing sessions for that user.
- Session middleware must reject disabled users even when the session row is still unexpired.

## Role model

| Role | Intended users | Allowed actions |
|---|---|---|
| `viewer` | Client/stakeholder read-only access | View fleet/kiosk health, sessions, tickets, schedules, and audit summaries. No writes or fake controls. |
| `operator` | HQ/event operator | Viewer rights plus issue/retry safe kiosk operations: refresh status, enter/exit maintenance, run HQ smoke controls when fake/dev mode is explicitly enabled, view command results. |
| `admin` | Acmea ops/admin | Operator rights plus manage users below superadmin, schedules/campaign assignments, kiosk metadata, command issuance, and session revocation. |
| `superadmin` | Platform owner/break-glass | Full access including role grants, global settings, auth configuration, destructive recovery operations, and emergency credential rotation. |

Default policy: deny unless a route declares the minimum role. Destructive or hardware-affecting actions should require `admin` or `superadmin`, and some should also require explicit confirmation/audit reason.

## Routes to protect

Current local backend observations from `services/local-backend/src/server.ts`:

- Global `onRequest` only checks CORS plus optional `LOCAL_BACKEND_AUTH_TOKEN` bearer/header/query token.
- `/admin` and `/admin/*` serve the admin dashboard static files.
- `/admin/api/telemetry` and `/telemetry` return admin telemetry.
- `/dev/token` and `/print/test` are fake hardware routes gated only by `LOCAL_BACKEND_ENABLE_DEV_ROUTES` plus the optional local token.
- `/maintenance/enter` and `/maintenance/exit` change runtime mode.
- `/health`, `/state`, `/schedules`, `/ws`, and `/player` are currently served by the same local backend.

Protection recommendation:

| Route/group | Auth requirement | Minimum role | Notes |
|---|---|---|---|
| `GET /admin`, `/admin/*` | Admin session cookie | any active role | Static app may load login screen unauthenticated, but real dashboard data/actions must require session. Prefer serving shell while APIs enforce auth. |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Login public; logout/me session | n/a | New central/local auth endpoints. Rate-limit login. |
| `GET /admin/api/telemetry`, `GET /telemetry` | Admin session | `viewer` | Consider deprecating public `/telemetry` alias or making it token-only for service use. |
| `GET /state`, `GET /schedules`, `GET /schedules/:id` when called from admin UI | Admin session | `viewer` | Player/runtime use should have separate paths or kiosk token. |
| `PUT /schedules/:id/draft` | Admin session | `admin` | Schedule edits affect customer-facing behavior. |
| `POST /maintenance/enter`, `/maintenance/exit` | Admin session | `operator` | Audit actor and reason. |
| `POST /dev/token`, `POST /print/test` | Admin session + dev routes + fake hardware | `operator` | Must remain labeled HQ-only and unavailable in real/public mode. |
| Central `POST /v1/heartbeats`, `/v1/events/batch`, command poll/result routes | Kiosk/service credential, not admin cookie | n/a | Use device credentials/mTLS/API token later; separate from human auth. |
| `GET /health` / `/healthz` | Public or network-restricted | n/a | Must not leak secrets or user data. |
| `GET /player`, `/player/*`, websocket for player runtime | No human admin auth | n/a | Customer/player path should not depend on admin login; use local runtime controls and package bridge constraints. |

## Migration from current disabled login placeholder

1. Keep the current disabled `LoginCard` copy until backend auth exists; it correctly says auth is parked and must not be described as production-ready.
2. Add central auth schema and migrations for `admin_users`, roles, sessions, and audit.
3. Add a seed/bootstrap path for the first `superadmin` that requires an explicit one-time secret or CLI command; do not auto-create default passwords.
4. Add `/auth/login`, `/auth/logout`, `/auth/me`, and session middleware.
5. Replace the disabled login form in `apps/admin-dashboard/src/main.tsx` with a working form only after `/auth/me` is wired and tested.
6. Gate admin data/actions by route role. Start with read-only `/admin/api/telemetry`, then state/schedules, then control routes.
7. Add tests for login success/failure, session expiry/revocation, role denial, and fake-route gating.
8. Update deployment docs: required DB URL, session secret, bootstrap command, reverse proxy HTTPS/cookie settings, and rollback behavior.

## Non-goals for the first auth implementation

- No social login/OAuth/SAML until a real customer identity requirement exists.
- No MFA in the first implementation, beyond schema fields that do not affect login.
- No customer/player identity; this decision is only for admin/operator users.
- No production claims for local SQLite fallback.
- No replacement of kiosk/service credentials with human admin cookies.
- No hardware adapter enablement; fake token/print controls stay HQ-only unless real adapters are separately configured and verified.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `DATABASE_URL` ambiguity between central PostgreSQL and local SQLite | Auth data could land in the wrong store. | Prefer `CENTRAL_DATABASE_URL`; document `DATABASE_URL` as single-service fallback only. |
| Shipping UI login before DB-backed sessions | False production-auth claim. | Keep placeholder disabled until auth tables, middleware, and tests exist. |
| Shared bearer token confused with human auth | Weak accountability and no per-user audit. | Keep `LOCAL_BACKEND_AUTH_TOKEN` service-only; require admin sessions for human routes. |
| Fake HQ controls exposed outside HQ/dev mode | Could create fake tokens/prints in public deployments. | Require session role + `LOCAL_BACKEND_ENABLE_DEV_ROUTES=true` + fake hardware mode; label UI as HQ-only. |
| Password/session secret leakage | Account takeover. | Store secrets in deployment secret manager/env, never commit; hash passwords and tokens only. |
| Role sprawl or over-permissive defaults | Operators get destructive access. | Deny by default; route-level minimum role table; audit all writes. |
| Offline local admin expectations | Operators may expect central login when network is down. | Treat local SQLite auth as dev/HQ fallback only until an explicit offline-admin design is approved. |

## Acceptance criteria for implementation card

A later implementation card should not be accepted as production auth unless it demonstrates:

- Central DB auth migrations applied from `CENTRAL_DATABASE_URL` or documented `DATABASE_URL` fallback.
- No default password exists in code, docs, tests, or migrations.
- `/auth/login`, `/auth/logout`, `/auth/me` work with Argon2id and database-backed sessions.
- Admin telemetry/control routes reject unauthenticated requests and enforce role denial.
- Fake token/print routes remain HQ-only and unavailable when dev routes or fake hardware mode are disabled.
- Audit rows identify actor, action, subject, timestamp, and request context without secrets.
- Automated tests cover success, failure, expiry/revocation, and role checks.
