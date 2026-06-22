# Central Back Office Control Plane Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Move the real back office from the kiosk-local `/admin` surface to a Hermes-node central control plane that receives kiosk uploads, monitors spins/tickets/hardware, edits ticket templates/assets, and manages schedules/module deployments.

**Architecture:** The kiosk remains an edge runtime with local SQLite, coin/token handling, player UI, printer control, and a small local fallback admin. The Hermes node runs the central API, central database, asset store, admin web frontend, schedule/deployment registry, and reporting. Kiosks upload append-only events/heartbeats/tickets and poll for signed/idempotent commands; central admin never needs to browse into each kiosk for normal operations.

**Tech Stack:** pnpm monorepo, Node 22, TypeScript, Fastify or existing `node:http` central API, Drizzle/Postgres for central DB, React/Vite admin dashboard, local backend SQLite edge runtime, systemd on Hermes/kiosk nodes, Caddy/Nginx/LE later for HTTPS.

---

## Current Findings

- Existing kiosk-local admin UI lives in `apps/admin-dashboard/` and is served by `services/local-backend/src/server.ts` at `/admin` from `apps/admin-dashboard/dist-web`.
- Current local admin already displays live `/health`, `/state`, `/admin/api/telemetry`, `/admin/api/game-runs`, and `/admin/api/campaign-preview` from the kiosk-local backend.
- Current campaign preview explicitly reports `editing_supported: false` and `store_operator_editing: disabled-read-only-v1`.
- Existing central API skeleton exists in `services/central-api/` with:
  - `POST /v1/heartbeats`
  - `POST /v1/events/batch`
  - `GET /v1/kiosks/:kioskId/commands`
  - `POST /v1/commands/:commandId/result`
- Existing central schema in `services/central-api/src/db/schema.ts` already includes `locations`, `kiosks`, `heartbeats`, `sessions`, `events`, `tickets`, `device_commands`, `command_results`, and `audit_log`.
- Existing `services/kiosk-agent/src/index.ts` submits heartbeats and polls commands, but does not yet upload local event/ticket/session queues.
- Existing admin dashboard package can be reused, but should be split conceptually into:
  - **central admin**: real back office on Hermes node.
  - **local admin**: fallback/debug console on kiosk.
- Root DOX contract requires central contract changes in `packages/shared-types`, DB changes with Drizzle checks, and docs/runbooks updated for host/service assumptions.

## Target URLs

Initial internal/LAN deployment:

- Central API on Hermes node: `http://192.168.1.240:8877`
- Central admin on Hermes node: `http://192.168.1.240:<admin-port>/admin` or served by central API at `/admin`
- Kiosk local fallback: `http://192.168.1.117:8787/admin`

Final production-style deployment:

- `https://admin.acmea.tech` or campaign-specific admin domain via Caddy/Nginx + Let's Encrypt.

## Non-Negotiable Contracts

- Kiosk must keep working offline.
- Event upload must be append-only and idempotent by `(kiosk_id, local_sequence)` and/or `event_id`.
- Central commands must be idempotent with `idempotency_key` and expire safely.
- Campaign editing must not mutate historical tickets; ticket records must carry template/asset version metadata.
- Ticket logo/bitmap processing must produce printer-safe output before allowing activation.
- Module deployment must support `scheduled`, `next-safe-boundary`, and `immediate` activation, with rollback to previous known-good release.
- Local kiosk admin remains available for emergency/debug only; real operational admin is central.

---

## Phase 1: Central Monitoring Foundation

### Task 1: Add central read APIs for fleet overview

**Objective:** Expose central DB data needed by the admin dashboard.

**Files:**
- Modify: `services/central-api/src/repository.ts`
- Modify: `services/central-api/src/routes.ts`
- Test: `services/central-api/test/central-api.test.mjs`

**Steps:**
1. Add repository methods:
   - `listKiosks()`
   - `getKiosk(kioskId)`
   - `listRecentHeartbeats(limit)`
   - `listRecentEvents(filters)`
2. Add routes:
   - `GET /v1/admin/kiosks`
   - `GET /v1/admin/kiosks/:kioskId`
   - `GET /v1/admin/events?limit=&kiosk_id=&event_type=`
3. Write tests using `InMemoryCentralRepository` first.
4. Run:
   - `pnpm --filter @retail-kiosk/central-api test`
   - `pnpm --filter @retail-kiosk/central-api typecheck`

**Acceptance Criteria:** Admin can retrieve kiosk list, latest heartbeat, status, active package, and recent events from central API.

### Task 2: Add kiosk event upload client to kiosk-agent

**Objective:** Let kiosk-agent upload local events, not only heartbeats.

**Files:**
- Modify: `services/kiosk-agent/src/index.ts`
- Modify: `packages/shared-types/src/events.ts` if event upload cursor types are needed
- Test: `services/kiosk-agent/test/smoke.test.mjs`

**Steps:**
1. Add config fields:
   - `local_backend_base_url`
   - `event_upload_batch_size`
   - `last_uploaded_sequence_path`
2. Add client call to local backend export endpoint. If missing, add it in Task 3.
3. Submit batches to central `POST /v1/events/batch`.
4. Persist upload cursor only after central confirms insert/duplicate.
5. Retry on failure without dropping events.

**Acceptance Criteria:** Agent can upload events idempotently and resume after restart.

### Task 3: Add local backend event export endpoint

**Objective:** Provide kiosk-agent a safe way to read local events after a cursor.

**Files:**
- Modify: `services/local-backend/src/server.ts`
- Test: `services/local-backend/test/local-api.test.mjs`

**Steps:**
1. Add route `GET /admin/api/events/export?after_sequence=&limit=`.
2. Return normalized `EventEnvelope[]` matching `packages/shared-types/src/events.ts`.
3. Require admin/dev auth if local backend auth is configured.
4. Include total/cursor metadata.

**Acceptance Criteria:** Local backend exports events in local sequence order and never exposes secrets.

### Task 4: Build central admin fleet dashboard page

**Objective:** Show central fleet status from central API, not kiosk-local endpoints.

**Files:**
- Modify: `apps/admin-dashboard/src/main.tsx`
- Modify: `apps/admin-dashboard/src/styles.css`
- Test: `apps/admin-dashboard/test/smoke.test.mjs`

**Steps:**
1. Introduce runtime mode: `central` vs `local` based on config or served API root.
2. Add central data hooks for `/v1/admin/kiosks` and `/v1/admin/events`.
3. Create dashboard cards:
   - total kiosks
   - online/offline
   - last heartbeat
   - events uploaded
   - printer/token health
4. Keep current local admin route available for fallback.

**Acceptance Criteria:** Opening the Hermes-node admin shows kiosk-0 status from central DB.

---

## Phase 2: Spins, Sessions, Tickets, and Reporting

### Task 5: Materialize sessions/tickets from uploaded events

**Objective:** Central API should create queryable session/ticket rows from incoming event stream.

**Files:**
- Modify: `services/central-api/src/repository.ts`
- Modify: `services/central-api/src/db/schema.ts` if fields are missing
- Add migration via: `pnpm db:generate:central`
- Test: `services/central-api/test/central-api.test.mjs`

**Steps:**
1. During `ingestEvents`, detect session/ticket lifecycle events:
   - `session_started`
   - `token_received`
   - `spin_started`
   - `outcome_selected`
   - `prize_revealed`
   - `ticket_created`
   - `ticket_print_requested`
   - `ticket_print_success`
   - `ticket_print_failed`
   - `session_completed`
2. Upsert `sessions` and `tickets` records.
3. Preserve raw events as source of truth.
4. Add indexes for date/kiosk/campaign/print status.

**Acceptance Criteria:** Central admin can query sessions and tickets without reconstructing every row in the browser.

### Task 6: Add central spin and ticket APIs

**Objective:** Provide admin endpoints for operations and reporting.

**Files:**
- Modify: `services/central-api/src/routes.ts`
- Modify: `services/central-api/src/repository.ts`
- Test: `services/central-api/test/central-api.test.mjs`

**Routes:**
- `GET /v1/admin/spins?from=&to=&kiosk_id=&campaign=&outcome=&limit=`
- `GET /v1/admin/tickets?from=&to=&print_status=&kiosk_id=&limit=`
- `GET /v1/admin/tickets/:ticketId`
- `GET /v1/admin/reports/today`

**Acceptance Criteria:** Central admin can show latest spins, prizes, ticket codes, and print statuses for all kiosks.

### Task 7: Add mobile operator monitoring view

**Objective:** Provide phone-friendly operator screens.

**Files:**
- Modify: `apps/admin-dashboard/src/main.tsx`
- Modify: `apps/admin-dashboard/src/styles.css`
- Test: `apps/admin-dashboard/test/smoke.test.mjs`

**Screens:**
- Today summary
- Kiosks/alerts
- Latest tickets
- Failed prints

**Verification:**
- Playwright viewport 390x844: no page-level horizontal overflow.
- Only data tables may scroll internally.

**Acceptance Criteria:** JM can monitor kiosk health and recent spins from mobile.

---

## Phase 3: Ticket Template Designer

### Task 8: Extend central schema for ticket templates

**Objective:** Store editable, versioned ticket templates centrally.

**Files:**
- Modify: `services/central-api/src/db/schema.ts`
- Add migration via: `pnpm db:generate:central`
- Modify: `packages/shared-types/src/tickets.ts`
- Test: `packages/shared-types/test/contracts.test.mjs`

**Tables:**
- `ticket_templates`
  - `template_id`
  - `campaign_id`
  - `version`
  - `status`: draft/active/archived
  - `locale_payload`: FR/NL header/body/cashier/terms
  - `asset_id`
  - `created_by`
  - timestamps
- `ticket_template_versions` if history is separated.

**Acceptance Criteria:** Template updates create new versions; existing ticket records keep old render payload/template metadata.

### Task 9: Add ticket template API

**Objective:** Create CRUD endpoints for ticket template drafts and activation.

**Files:**
- Modify: `services/central-api/src/routes.ts`
- Modify: `services/central-api/src/repository.ts`
- Test: `services/central-api/test/central-api.test.mjs`

**Routes:**
- `GET /v1/admin/ticket-templates`
- `POST /v1/admin/ticket-templates`
- `GET /v1/admin/ticket-templates/:id`
- `PUT /v1/admin/ticket-templates/:id/draft`
- `POST /v1/admin/ticket-templates/:id/activate`
- `POST /v1/admin/ticket-templates/:id/preview`

**Acceptance Criteria:** Admin can edit FR/NL header/body/footer and activate a template version.

### Task 10: Build ticket designer UI

**Objective:** Add back-office ticket editor and preview.

**Files:**
- Modify: `apps/admin-dashboard/src/main.tsx`
- Modify: `apps/admin-dashboard/src/styles.css`
- Test: `apps/admin-dashboard/test/smoke.test.mjs`

**UI Sections:**
- Header text FR/NL
- Prize/body text FR/NL
- Cashier instruction FR/NL
- Terms/footer FR/NL
- QR payload template
- Bitmap/logo selector
- Preview panel
- Save draft / activate / test print

**Acceptance Criteria:** Admin can create a ticket template draft and preview it before activation.

---

## Phase 4: Bitmap / Drawing Upload for Ticket Header

### Task 11: Add central asset store schema and API

**Objective:** Store uploaded logo/bitmap originals and processed printer-safe outputs.

**Files:**
- Modify: `services/central-api/src/db/schema.ts`
- Modify: `services/central-api/src/routes.ts`
- Modify: `services/central-api/src/repository.ts`
- Test: `services/central-api/test/central-api.test.mjs`

**Tables:**
- `assets`
  - `asset_id`
  - `kind`: ticket_header_bitmap / campaign_image / module_asset
  - `filename`
  - `mime_type`
  - `original_path`
  - `processed_path`
  - `width`
  - `height`
  - `checksum`
  - `status`

**Routes:**
- `POST /v1/admin/assets`
- `GET /v1/admin/assets`
- `GET /v1/admin/assets/:assetId`
- `GET /v1/admin/assets/:assetId/original`
- `GET /v1/admin/assets/:assetId/processed`

**Acceptance Criteria:** Admin can upload image and retrieve processed preview metadata.

### Task 12: Add thermal-printer image processing

**Objective:** Convert uploaded bitmap/logo to printer-safe monochrome output.

**Files:**
- Add: `services/central-api/src/assets/process-ticket-bitmap.ts`
- Test: `services/central-api/test/assets.test.mjs`

**Rules:**
- Accept PNG/JPG/BMP initially.
- Reject oversized files.
- Resize to printer printable width.
- Convert to 1-bit monochrome/dithered preview.
- Store original and processed artifact.

**Acceptance Criteria:** Uploaded artwork produces a preview suitable for top-of-ticket printing.

### Task 13: Add bitmap upload UI

**Objective:** Let JM upload a drawing/logo and assign it to a ticket template.

**Files:**
- Modify: `apps/admin-dashboard/src/main.tsx`
- Modify: `apps/admin-dashboard/src/styles.css`
- Test: `apps/admin-dashboard/test/smoke.test.mjs`

**Acceptance Criteria:** Admin can upload an image, see preview, select it in the ticket designer, and save template draft.

---

## Phase 5: Schedule and Module Deployment Center

### Task 14: Extend schema for packages, modules, deployments, and schedules

**Objective:** Model central deployment control explicitly.

**Files:**
- Modify: `services/central-api/src/db/schema.ts`
- Modify: `packages/shared-types/src/commands.ts`
- Add migration via: `pnpm db:generate:central`
- Test: `packages/shared-types/test/contracts.test.mjs`

**Tables:**
- `campaign_packages`
- `module_versions`
- `kiosk_groups`
- `kiosk_group_members`
- `deployment_plans`
- `deployment_targets`
- `schedules`
- `schedule_slots`
- `package_assets`

**Command Types:**
- `sync_package`
- `activate_schedule`
- `activate_module`
- `rollback_module`
- `test_print`
- `enter_maintenance`
- `exit_maintenance`

**Acceptance Criteria:** Central DB can represent package availability, deployment target state, and schedule assignment.

### Task 15: Add deployment command APIs

**Objective:** Let central admin issue schedule/module deployment commands to kiosks.

**Files:**
- Modify: `services/central-api/src/routes.ts`
- Modify: `services/central-api/src/repository.ts`
- Test: `services/central-api/test/central-api.test.mjs`

**Routes:**
- `GET /v1/admin/modules`
- `GET /v1/admin/deployments`
- `POST /v1/admin/deployments`
- `POST /v1/admin/deployments/:id/publish`
- `POST /v1/admin/kiosks/:kioskId/commands/rollback`
- `GET /v1/admin/schedules`
- `POST /v1/admin/schedules`
- `POST /v1/admin/schedules/:id/publish`

**Acceptance Criteria:** Central admin can create deployment/schedule plans and enqueue commands for kiosk polling.

### Task 16: Implement kiosk-agent package/schedule command execution

**Objective:** Make kiosk agent execute real deployment commands safely.

**Files:**
- Modify: `services/kiosk-agent/src/index.ts`
- Modify: `infra/` systemd/env templates as needed
- Test: `services/kiosk-agent/test/smoke.test.mjs`

**Execution Rules:**
- Download package to staging.
- Verify checksum/signature.
- Cache assets.
- For `next-safe-boundary`, wait until local runtime is idle.
- Atomically switch release/schedule symlink/config.
- Restart only required services.
- Report evidence and status back to central.

**Acceptance Criteria:** Kiosk can receive central deployment command and report success/failure with evidence.

### Task 17: Build schedule/deployment center UI

**Objective:** Add first-class back-office section for organising schedules and module deployments.

**Files:**
- Modify: `apps/admin-dashboard/src/main.tsx`
- Modify: `apps/admin-dashboard/src/styles.css`
- Test: `apps/admin-dashboard/test/smoke.test.mjs`

**UI Sections:**
- Module library
- Kiosk/kiosk-group assignment
- Calendar/timeline schedule
- Deployment plan status
- Publish buttons for immediate/safe-boundary/scheduled
- Rollback panel
- Audit trail

**Acceptance Criteria:** JM can schedule a module for kiosk-0 and see deployment status update from agent command results.

---

## Phase 6: Hosting on Hermes Node

### Task 18: Add Hermes-node systemd/Caddy deployment docs

**Objective:** Make central admin/API a real service on Hermes node.

**Files:**
- Add: `docs/runbooks/central-back-office.md`
- Add/Modify: `infra/central-api.service`
- Add/Modify: `infra/central-admin.service` if admin is separate from central API
- Add/Modify: `infra/env.central.example`

**Steps:**
1. Decide single-process vs two-process serving:
   - Option 1: central API serves admin static build at `/admin`.
   - Option 2: separate Vite/static service reverse-proxied by Caddy/Nginx.
2. Configure systemd service under Hermes node.
3. Configure DB env and asset storage path.
4. Document backup/restore.
5. Document LAN and HTTPS access.

**Acceptance Criteria:** Central admin and API restart cleanly via systemd and survive reboot.

### Task 19: Add smoke verification script

**Objective:** Verify end-to-end central admin health.

**Files:**
- Add: `scripts/verify-central-back-office.mjs`
- Test: use existing package tests plus script execution.

**Checks:**
- `/healthz`
- `/v1/admin/kiosks`
- central admin static loads
- no browser console errors
- mobile viewport no page-level horizontal overflow
- kiosk-agent heartbeat visible
- event batch upload idempotency

**Acceptance Criteria:** One command proves central back office is operational.

---

## Implementation Order Recommendation

1. Phase 1 Tasks 1-4: central monitoring foundation.
2. Phase 2 Tasks 5-7: real spins/tickets reporting.
3. Phase 6 Tasks 18-19: host central admin on Hermes node early.
4. Phase 3 Tasks 8-10: ticket template editor.
5. Phase 4 Tasks 11-13: bitmap upload and processing.
6. Phase 5 Tasks 14-17: schedule/deployment center.

Reason: central monitoring gives immediate value and validates the sync pipeline before we let central admin mutate kiosk behavior.

## First Execution Packet

If approved, execute this first packet:

1. Add central read APIs for kiosks/events.
2. Add local backend event export endpoint.
3. Add kiosk-agent event uploader with durable cursor.
4. Add central admin fleet dashboard mode.
5. Run tests:
   - `pnpm --filter @retail-kiosk/shared-types test`
   - `pnpm --filter @retail-kiosk/central-api test`
   - `pnpm --filter @retail-kiosk/local-backend test`
   - `pnpm --filter @retail-kiosk/kiosk-agent test`
   - `pnpm --filter @retail-kiosk/admin-dashboard test`
6. Deploy central API/admin to Hermes node in LAN mode.
7. Verify kiosk-0 uploads data to Hermes node and appears in central admin.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Central server offline | Kiosk keeps local queue and retries upload. |
| Duplicate uploads | Central idempotency on event ID and local sequence. |
| Bad deployment breaks kiosk | Use staging, checksum verification, safe-boundary activation, rollback. |
| Uploaded bitmap prints badly | Require processed thermal preview and test print before activation. |
| Admin becomes cluttered | Split mobile operator view from desktop campaign/deployment tools. |
| Historical ticket inconsistency | Version templates/assets and snapshot render payload on each ticket. |

## DOX Closeout Note

This plan adds durable architecture direction under `docs/plans/` only. It does not change source contracts yet, so root `AGENTS.md` does not require an update in this planning step. Implementation tasks that modify `services/central-api`, `services/kiosk-agent`, `services/local-backend`, `apps/admin-dashboard`, `packages/shared-types`, `infra`, or `docs/runbooks` must re-check and update DOX as required by the root contract.
