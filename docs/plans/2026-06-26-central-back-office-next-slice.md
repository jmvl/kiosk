# Central back-office next-slice backlog

Status: planning backlog, not implementation
Date: 2026-06-26
Source snapshot: git `2482217d0cd10fcf602ccbc07dfa71fde26e2494` on branch `dow-i11-campaign-schema`, inspected at 2026-06-26T13:55:52Z
Scope: central back office vs v1 needs for fleet overview, kiosk detail, events, schedules/deployments, ticket template editor, bitmap/logo upload, auth/roles, and audit.

## Evidence base

Code and docs inspected:

- `services/central-api/src/routes.ts`
- `services/central-api/src/repository.ts`
- `services/central-api/src/db/schema.ts`
- `services/central-api/test/central-api.test.mjs`
- `services/kiosk-agent/src/index.ts`
- `services/local-backend/src/server.ts`
- `apps/admin-dashboard/src/main.tsx`
- `apps/admin-dashboard/test/smoke.test.mjs`
- `apps/admin-dashboard/README.md`
- `docs/plans/2026-06-22-central-back-office-control-plane.md`
- `docs/admin-dashboard.md`
- `docs/admin-auth-decision.md`

Assumptions:

- v1 central back office must use live central data only; no fake central schedules, fake central deployments, fake auth, or fake audit claims.
- Kiosks remain local-first: token/play/print continue locally while the central API receives heartbeats/events and issues safe commands.
- `LOCAL_BACKEND_AUTH_TOKEN` remains a service/local control token, not human admin authentication.
- Ticket template and bitmap changes must be versioned and must not rewrite historical tickets.

Confidence: high for implemented/not-implemented status from code inspection; medium for effort sequencing because implementation cost depends on hosting, PostgreSQL availability, and whether central admin is served by the API or as separate static hosting.

## Current state vs v1 need

| Area | Current state | v1 needed | Gap / decision |
|---|---|---|---|
| Fleet overview | Central API has `GET /v1/admin/fleet/overview` and `GET /v1/admin/kiosks`; repository derives kiosk summaries from latest heartbeat rows or in-memory heartbeats. Admin dashboard reads these through `VITE_CENTRAL_API_BASE_URL`. | Fleet list with status, location, last seen, active package, queue length, printer/token health, versions, today plays, tickets printed, and warning counts. | Need central aggregation for today plays/tickets and warning counts from uploaded events/tickets. Current endpoint is monitoring-only and does not materialize sessions/tickets. |
| Kiosk detail | Central API has `GET /v1/admin/kiosks/:kioskId` with latest heartbeat payload. Admin UI currently shows a central kiosk table, not a full central detail route/page. | Per-kiosk detail page with heartbeat timeline, hardware state, latest events, active campaign/schedule, command timeline, logs, and safe remote actions. | Add central detail read model and UI route before enabling write actions. Keep unsafe actions disabled until auth/roles/audit exist. |
| Events | Kiosk agent uploads local events from `/admin/api/events/export` to `POST /v1/events/batch`; central API stores raw events idempotently by event ID/local sequence and exposes `GET /v1/admin/events`. | Queryable event stream with filters, append-only semantics, retained raw payloads, and operational views for sessions, tickets, print failures, and sync health. | Raw stream exists; missing materialized session/ticket/report views and stronger conflict reporting for duplicate local sequence with different event IDs. |
| Schedules | Local backend has local scheduler APIs and admin UI local draft/publish-only controls. Central API has read endpoints `GET /v1/admin/schedules` and `GET /v1/admin/deployments`, but they intentionally return empty `control_plane.ready=false` placeholders. | Central schedule registry with target scope, versioning, package references, cache readiness, safe-boundary activation, publish flow, and rollback. | Need central schema, migrations, write APIs, and agent execution. Keep central UI read-only until tables and auth/audit are in place. |
| Deployments | Central schema has `device_commands`/`command_results`; kiosk agent polls and executes allowlisted `test_print`, `enter_maintenance`, `exit_maintenance`, and `upload_logs`. Central admin command enqueue route is explicitly unsupported/404 in tests. | Deployment plans, target state, package/module library, schedule activation commands, rollout status, health checks, rollback, restore path, and evidence. | Need deployment tables, command enqueue APIs, command confirmation/audit, and real package/schedule execution in the agent. Current command execution is partly skeleton/simulated. |
| Ticket template editor | Local campaign preview exposes manifest `ticket_templates`, bitmap assets, QR payload patterns, and explicitly `editing_supported: false`. Central schema has `tickets` with `render_payload`, but no template tables. | Central CRUD for draft/active/archived ticket template versions, FR/NL copy, QR template, preview, activation, and historical ticket snapshot preservation. | Need shared ticket template contract, central schema/migrations, template APIs, UI editor, and renderer/preview tests. |
| Bitmap/logo upload | Campaign manifests and local preview can list bitmap assets. No central asset table/API or printer-safe image processor exists. | Upload original artwork, store checksum/metadata, produce thermal-printer-safe processed output, preview before activation, attach to template version. | Need asset store decision, upload validation, image processing, file/object storage paths, and test-print gate. |
| Auth and roles | `docs/admin-auth-decision.md` defines the direction. UI login is disabled and states auth is parked. Central admin routes are unauthenticated; CORS allows origin reflection. No `admin_users`/roles/sessions tables exist in central schema. | DB-backed admin users, Argon2id password hashes, opaque HttpOnly session cookies, viewer/operator/admin/superadmin roles, route middleware, denial tests, bootstrap flow. | Auth is the highest security gap before central writes. Do not expose mutation routes publicly before this lands. |
| Audit | Central schema has generic `audit_log`, but no route middleware or actor-linked writes. Local scheduler has local audit rows/events. | Append-only audit of login/logout, role changes, schedule/template edits, asset uploads, commands, deployments, rollbacks, test prints, and destructive recovery. | Extend audit schema or add admin audit table with actor/subject/request metadata; wire all write routes through it. |
| Hosting / ops | Central API can run from `services/central-api/src/index.ts` with `CENTRAL_DATABASE_URL`/`DATABASE_URL`, falling back to in-memory repository. Infra has kiosk systemd units/env, not central API/admin services. | Hermes-node service with PostgreSQL, admin static hosting or API-served static files, HTTPS proxy, env docs, backups, smoke verification. | Need central runbook, systemd/Caddy or Nginx decision, env template, and no production use of in-memory repository. |

## Recommended implementation backlog

### B0 — Security and live-data guardrails

Dependency: none. This is the gate for every central write feature.

1. Add a central service mode check that refuses production startup without `CENTRAL_DATABASE_URL` and a central auth mode once auth is implemented; keep in-memory only for tests/local development.
2. Add request logging/request IDs for central admin APIs without logging secrets or ticket codes in full.
3. Harden CORS configuration: explicit allowed admin origins for non-dev, not origin reflection by default.
4. Document that central admin mutation routes must not ship until auth, roles, and audit are active.

Acceptance:

- Tests prove central write routes remain absent/disabled before auth.
- Deployment docs distinguish dev/in-memory from production/PostgreSQL.

### B1 — Central sessions/tickets reporting from uploaded events

Dependencies: existing event upload path from kiosk agent; no auth required if read-only and network-restricted, but prefer behind auth once B3 lands.

1. Materialize `sessions` and `tickets` during `ingestEvents` while preserving raw events as source of truth.
2. Add idempotent upsert rules for session lifecycle and ticket lifecycle events.
3. Add endpoints:
   - `GET /v1/admin/sessions?from=&to=&kiosk_id=&campaign=&limit=`
   - `GET /v1/admin/tickets?from=&to=&print_status=&kiosk_id=&limit=`
   - `GET /v1/admin/reports/today`
4. Extend admin dashboard central read section with today plays, tickets printed, print failures, and latest tickets.

Acceptance:

- Replaying the same event batch does not duplicate sessions/tickets.
- Central dashboard metrics come from event/session/ticket tables, not seed data.

### B2 — Central kiosk detail and event drill-down

Dependencies: B1 for useful session/ticket detail.

1. Extend `GET /v1/admin/kiosks/:kioskId` to include latest events, recent sessions, recent tickets, command/result summary, and heartbeat timeline.
2. Add admin UI kiosk detail view or expandable detail panel.
3. Add filters to central event UI for kiosk and event type.

Acceptance:

- A kiosk detail page can be opened from the fleet table and shows only central API data.
- Missing data renders explicit empty states, never demo rows.

### B3 — Admin auth, roles, and audit foundation

Dependencies: central PostgreSQL migration path; should precede central mutation routes.

1. Implement central auth tables from `docs/admin-auth-decision.md`: `admin_users`, roles/join table, `admin_sessions`, and actor-aware audit.
2. Add `/auth/login`, `/auth/logout`, `/auth/me`, session middleware, password hashing, and first-superadmin bootstrap command.
3. Require roles: viewer for reads, operator for safe commands/test print, admin for schedules/templates/deployments, superadmin for user management/break-glass operations.
4. Wire audit helper for all admin write attempts, including denied attempts where useful.

Acceptance:

- No default password exists in code/docs/tests.
- Unauthenticated central admin API reads/writes are rejected except health and login/bootstrap paths.
- Role denial and audit tests cover representative routes.

### B4 — Central schedule registry and deployment read/write model

Dependencies: B3 for writes; B0 for production DB guardrails.

1. Add central tables for packages, module versions, kiosk groups, schedules, schedule slots, deployment plans, deployment targets, and package assets.
2. Add write APIs for draft schedules/deployments and publish actions.
3. Keep command enqueue as a separate audited step with idempotency keys, expiry, target validation, and confirmation flags.
4. Update dashboard from raw JSON placeholders to structured module library, target selection, and plan status views.

Acceptance:

- Central `GET /v1/admin/schedules` and `GET /v1/admin/deployments` return real table-backed rows with `control_plane.ready=true`.
- Publishing creates audited deployment/command records; it does not directly mutate kiosk state outside the command lifecycle.

### B5 — Kiosk-agent real deployment/schedule command execution

Dependencies: B4 command records; package storage/checksum policy.

1. Extend allowed agent commands to include package sync, schedule activation, module activation, and rollback only after signatures/checksums and staging paths are defined.
2. Download to staging, verify checksum/signature, cache assets, switch at safe boundary, and report evidence.
3. Preserve previous known-good package/schedule and local unsynced events before rollback/restore actions.
4. Add systemd/env updates for package cache paths and log/evidence paths.

Acceptance:

- Agent reports accepted/running/succeeded/failed/expired states with evidence.
- Failed activation leaves kiosk on previous known-good schedule/package.

### B6 — Ticket template editor

Dependencies: B3 auth/audit; B1 ticket reporting for historical preservation; B4 package/campaign identity helps target templates.

1. Add shared ticket template types with locale payloads, QR payload template, asset reference, status, and version.
2. Add central schema/API for template draft, preview, activation, archive, and version history.
3. Add UI editor for FR/NL header/body/cashier/terms, QR payload template, asset selector, preview, and activation confirmation.
4. Snapshot template ID/version and render payload onto each ticket at creation time.

Acceptance:

- Activating a new template version does not alter already-created ticket rows.
- Preview/test print is explicit and audited; it does not masquerade as a redeemed customer ticket.

### B7 — Bitmap/logo upload and printer-safe processing

Dependencies: B3 auth/audit; B6 template references; asset storage path from B4/B8.

1. Add asset schema/API for originals and processed outputs with MIME type, dimensions, checksum, storage paths, status, and owner metadata.
2. Implement PNG/JPG/BMP validation, size limits, monochrome/dither conversion, printable width resizing, and preview metadata.
3. Add admin upload UI and assign processed asset to ticket template drafts.
4. Require processed preview and optional test print before template activation.

Acceptance:

- Oversized/unsupported images are rejected with safe errors.
- Accepted assets produce a printer-safe processed artifact and checksum.

### B8 — Hermes-node central hosting and smoke verification

Dependencies: B0 for production mode; B3 if exposed outside a private LAN.

1. Decide central admin hosting shape: central API serves built admin at `/admin`, or separate static service behind Caddy/Nginx.
2. Add `infra/` systemd units/env templates for central API/admin and documented PostgreSQL/asset paths.
3. Add `docs/runbooks/central-back-office.md` with install, backup, restore, HTTPS, and rollback.
4. Add smoke verifier covering `/healthz`, auth, fleet reads, event upload idempotency, admin static load, mobile viewport, and no fake central schedules/deployments.

Acceptance:

- One command verifies central back office health on the Hermes node.
- In-memory central repository is not used for production deployment.

## Suggested next execution packet

Implement in this order:

1. B0 central guardrails and CORS/config hardening.
2. B1 session/ticket materialization and report reads.
3. B2 kiosk detail UI/read model.
4. B3 auth/roles/audit before any central write route.
5. B8 hosting runbook/smoke verifier once read-only central monitoring is useful on Hermes node.
6. B4/B5 schedule and deployment writes/execution.
7. B6/B7 ticket template editor and bitmap upload.

Reasoning:

- Read-only central monitoring already has the core heartbeat/event plumbing; session/ticket reporting gives immediate operator value without opening unsafe central mutation paths.
- Auth/roles/audit must precede central writes so schedule, deployment, template, and bitmap edits never ship as unauthenticated operations.
- Hosting should arrive after enough real read-only value exists, but before mutation-heavy features, so service/security assumptions are verified early.

## Risks and controls

| Risk | Control |
|---|---|
| Fake central confidence from in-memory repository or empty schedule/deployment placeholders | Keep placeholders explicit; production startup must require real DB; UI must show unavailable/empty states. |
| Central writes without human accountability | Block write routes behind B3 auth/roles/audit. |
| Broken deployment bricks kiosk | Stage, verify checksum/signature, activate at safe boundary, preserve previous known-good, and require rollback evidence. |
| Ticket history changes after template edits | Version templates/assets and snapshot render payload/template metadata onto tickets. |
| Bad bitmap damages print quality | Process to printer-safe output and require preview/test print before activation. |
| CORS/auth confusion exposes admin APIs | Use explicit origins, HttpOnly session cookies, role middleware, and separate kiosk/service credentials. |

## DOX closeout

This planning artifact lives under `docs/plans/` and does not change runtime contracts, source APIs, ownership, or repository structure. The root `AGENTS.md` remains accurate: `docs/` is already listed as the owning scope and no child `AGENTS.md` exists under `docs/` or `docs/plans/`.
