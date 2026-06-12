# Tasks — Greenfield Platform Foundation

## 1. Spec / Planning

- [x] 1.1 Create greenfield proposal.
- [x] 1.2 Define target repository shape.
- [x] 1.3 Define recommended technology stack.
- [x] 1.4 Define architecture and non-negotiable boundaries.
- [x] 1.5 Define capability requirements.
- [x] 1.6 Add fleet management, GPS telemetry, remote operations, campaign scheduling, and restore/recovery requirements.
- [x] 1.7 Validate OpenSpec delta syntax with `openspec validate --all`.

## 2. Repo Realignment

- [ ] 2.1 Rename local backend concept to local runtime API in docs and service naming.
  - Modify: `services/local-backend/README.md`
  - Future optional rename: `services/local-backend/` → `services/local-runtime-api/`
  - Verify naming communicates local runtime/source-of-truth responsibility.

- [ ] 2.2 Add runtime-validating Zod campaign schema.
  - Modify: `packages/campaign-schema/package.json`
  - Modify: `packages/campaign-schema/src/index.ts`
  - Expected: `CampaignManifestSchema.parse(manifest)` validates campaign data and invalid manifests fail with actionable errors.
  - Verify: `pnpm --filter @retail-kiosk/campaign-schema build` plus validation script/test.

- [ ] 2.3 Serve active campaign from local runtime API.
  - Modify: `services/local-backend/src/server.ts`
  - Add/read: `campaigns/chocomel/campaign.json`
  - Endpoint: `GET /api/campaign/current`
  - Verify endpoint returns Chocomel manifest in dev and validates against shared schema.

- [ ] 2.4 Refactor kiosk player to load campaign dynamically.
  - Modify: `apps/kiosk-player/src/main.tsx`
  - Optional create: `apps/kiosk-player/src/campaign.ts`
  - Verify kiosk player renders Chocomel from API response with loading/error states.

- [ ] 2.5 Add local session state machine owned by the backend.
  - Create: `services/local-backend/src/session-state.ts`
  - Modify: `services/local-backend/src/server.ts`
  - States: `idle → paid → spinning → question → prize_selected → printing → completed`
  - Verify simulated coin creates session, spin records backend-owned prize result, and print simulation only works for authorized result.

- [ ] 2.6 Add SQLite local persistence and offline buffer.
  - Modify: `services/local-backend/package.json`
  - Create: `services/local-backend/src/db.ts`
  - Create: `services/local-backend/src/events.ts`
  - Required fields: `id`, `kiosk_id`, `session_id`, `campaign_id`, `type`, `payload_json`, `occurred_at`, `sync_status`, `sync_attempts`, `last_sync_attempt_at`, `central_ack_id`.
  - Verify restarting backend preserves queued events and events can be recorded while central API is unavailable.

- [ ] 2.7 Add offline sync worker with idempotent central ingestion.
  - Create: `services/local-backend/src/sync-worker.ts`
  - Modify: `services/local-backend/src/server.ts`
  - Future modify: `services/central-api/src/*`
  - Verify pending events sync when central API returns and duplicate event ids do not create duplicate central records.

- [ ] 2.8 Add kiosk identity and heartbeat foundation.
  - Include serial number, kiosk name, assigned location, software versions, queue length, active campaign, GPS telemetry when available, and last-seen status.
  - Verify central API can distinguish kiosks by immutable serial number and dashboard/API can show fleet health.

- [ ] 2.9 Add remote command lifecycle foundation.
  - Commands include restart player/runtime/agent, reboot system, test print, upload logs, maintenance mode, resume mode, deploy, rollback, restore snapshot, and refresh campaign cache.
  - Verify commands move through `pending → sent → running → succeeded/failed/expired/cancelled` and are audit logged.

- [ ] 2.10 Add calendar campaign scheduling foundation.
  - Support targeting one kiosk, location, group, or fleet.
  - Include start/end datetime, timezone, priority, fallback campaign, cache readiness, and conflict detection.
  - Verify a cached Campaign B can activate after Campaign A at scheduled time even if internet is down.

- [ ] 2.11 Add restore snapshot foundation.
  - Support restore to known-good snapshot.
  - Preserve/back up unsynced events before restore.
  - Verify restored kiosk returns to attract mode when runtime, campaign cache, and hardware are healthy.

- [ ] 2.12 Add second sample campaign.
  - Create: `campaigns/sample-retail/campaign.json`
  - Create: `campaigns/sample-retail/README.md`
  - Verify runtime can switch active campaign without changing kiosk player source.

- [ ] 2.13 Add Docker Compose, Caddy, and systemd foundation.
  - Create: `docker-compose.yml`
  - Create: `infra/caddy/Caddyfile`
  - Create: `infra/systemd/kiosk-player.service.example`
  - Create: `infra/systemd/local-runtime-api.service.example`
  - Verify `docker compose config` succeeds.

- [ ] 2.14 Add CI hygiene.
  - Create: `.github/workflows/ci.yml`
  - Create/update: `CHANGELOG.md`
  - Verify `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm typecheck` succeed.

## 3. Acceptance Criteria

- [ ] 3.1 Kiosk player loads campaign from API/manifest, not hardcoded object.
- [ ] 3.2 Shared schema validates campaign packages at runtime.
- [ ] 3.3 Backend owns session/prize/print state.
- [ ] 3.4 Local events persist across restarts and internet outages.
- [ ] 3.5 Buffered events sync to central API idempotently when connectivity returns.
- [ ] 3.6 A second campaign proves multi-campaign architecture.
- [ ] 3.7 Fleet identity, GPS telemetry, remote commands, restore snapshot, and campaign calendar scheduling are represented in the central model/API.
- [ ] 3.8 Docker/Caddy/systemd/CI foundations exist for deployment hygiene.
