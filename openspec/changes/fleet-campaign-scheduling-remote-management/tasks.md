# Tasks: Fleet Campaign Scheduling and Remote Kiosk Management

## 1. Planning and Contracts

- [x] 1.1 Create OpenSpec change scaffold.
- [x] 1.2 Draft proposal for fleet campaign scheduling and remote kiosk management.
- [x] 1.3 Draft design covering kiosk registry, heartbeat, GPS, scheduler, remote commands, and restore flow.
- [x] 1.4 Draft delta specs for fleet management, campaign scheduling, remote operations, and restore recovery.
- [x] 1.5 Validate OpenSpec artifacts with `openspec validate fleet-campaign-scheduling-remote-management`.

## 2. Kiosk Registry and Identity

- [ ] 2.1 Add canonical kiosk registry model/table.
- [ ] 2.2 Add immutable `serial_number` and mutable human-readable `name`.
- [ ] 2.3 Add location/group assignment fields.
- [ ] 2.4 Add status, active campaign, next schedule, version, queue length, and last-seen fields.
- [ ] 2.5 Add API endpoint to register or upsert kiosk identity from agent heartbeat.
- [ ] 2.6 Verify serial number cannot be changed by rename/update operations.

## 3. Heartbeat, GPS, and Fleet Telemetry

- [ ] 3.1 Define heartbeat request/response schema.
- [ ] 3.2 Add kiosk agent heartbeat loop with simulated telemetry.
- [ ] 3.3 Include player/runtime/agent versions in heartbeat.
- [ ] 3.4 Include local queue length and active campaign in heartbeat.
- [ ] 3.5 Include GPS latitude, longitude, accuracy, timestamp, and GPS status when available.
- [ ] 3.6 Add stale/offline detection based on heartbeat timeout.
- [ ] 3.7 Add geofence/location-mismatch warning logic.

## 4. Remote Command Lifecycle

- [ ] 4.1 Add central command model/table.
- [ ] 4.2 Add command lifecycle states: `pending`, `sent`, `acknowledged`, `running`, `succeeded`, `failed`, `expired`, `cancelled`.
- [ ] 4.3 Add command polling or delivery endpoint for kiosk agent.
- [ ] 4.4 Implement simulated command execution for restart player/runtime/agent, test print, upload logs, maintenance mode, resume mode, and refresh campaign cache.
- [ ] 4.5 Add privileged command definitions for reboot, deploy, rollback, and restore snapshot as guarded no-op/simulation first.
- [ ] 4.6 Add command authorization, expiry, idempotency, and audit fields.
- [ ] 4.7 Verify duplicate command delivery does not execute the same command twice.

## 5. Campaign Scheduling

- [ ] 5.1 Add campaign schedule model/table.
- [ ] 5.2 Support targets: one kiosk, location, group, or whole fleet.
- [ ] 5.3 Support start/end datetime, timezone, priority, fallback campaign, and cache-readiness flag.
- [ ] 5.4 Add schedule conflict detection before publish.
- [ ] 5.5 Add API to publish schedules to kiosk-specific local schedule cache.
- [ ] 5.6 Add local runtime schedule evaluator.
- [ ] 5.7 Verify cached Campaign B can activate after Campaign A without internet.
- [ ] 5.8 Verify missing/invalid campaign falls back instead of blank screen.

## 6. Restore and Rollback

- [ ] 6.1 Define restore snapshot command contract.
- [ ] 6.2 Add local pre-restore safety step to pause new sessions where possible.
- [ ] 6.3 Add pre-restore backup/flush path for unsynced local events.
- [ ] 6.4 Add simulated restore execution path in kiosk agent.
- [ ] 6.5 Add rollback-version command path separate from full restore.
- [ ] 6.6 Verify restore result is logged locally and centrally when connectivity returns.
- [ ] 6.7 Verify restore does not delete unsynced events.

## 7. Admin/API Visibility

- [ ] 7.1 Add fleet overview API for 100+ kiosks with filters by status, location, campaign, version, and warning.
- [ ] 7.2 Add kiosk detail API exposing identity, GPS, heartbeat, versions, queue length, active campaign, next schedule, and recent command history.
- [ ] 7.3 Add command history API.
- [ ] 7.4 Add campaign calendar API.
- [ ] 7.5 Add restore/rollback status API.

## 8. Verification

- [ ] 8.1 Add unit tests for schedule conflict detection.
- [ ] 8.2 Add unit tests for local schedule evaluation and fallback behavior.
- [ ] 8.3 Add unit tests for command lifecycle transitions.
- [ ] 8.4 Add integration test for heartbeat upsert and offline/stale status.
- [ ] 8.5 Add integration test proving queued events survive restore simulation.
- [ ] 8.6 Run `pnpm build` and `pnpm typecheck`.
