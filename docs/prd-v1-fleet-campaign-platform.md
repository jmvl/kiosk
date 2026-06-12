# PRD v1 — Retail Kiosk Activation Fleet & Campaign Platform

Date: 2026-06-03
Status: Draft v1
Branch: `foundations`
Owner: Acmea Tech / JM

## 1. Executive Summary

Build a reusable retail kiosk activation platform capable of operating from 10 kiosks to 100+ kiosks across supermarket/retail locations.

The platform must run paid promotional game sessions locally even when internet connectivity is unavailable, buffer all operational and interaction data locally, and synchronize data back to the central platform when connectivity returns.

Each kiosk is a managed device with its own identity, serial number, name, GPS/location data, campaign schedule, health status, remote management commands, and restore/rollback capability.

Chocomel is Campaign #1, but the product is a reusable campaign and fleet operations platform.

## 2. Product Goals

### Business Goals

- Launch branded retail activation campaigns quickly across multiple supermarket locations.
- Manage kiosk fleets centrally without requiring on-site technical staff for routine recovery.
- Preserve data integrity for coins, sessions, prizes, tickets, and campaign analytics even during internet outages.
- Enable multiple campaigns per kiosk according to calendar schedules.
- Create a repeatable Acmea platform that can support many brands and campaigns.

### User / Operator Goals

- See every kiosk's online/offline/error/maintenance status.
- Identify each kiosk by serial number, name, location, GPS coordinates, software version, and active campaign.
- Remotely restart services, reboot the system, deploy updates, rollback versions, run test prints, and enter maintenance mode.
- Push or schedule campaigns to one kiosk, a group of kiosks, a location, or the whole fleet.
- Recover kiosk software to a known-good restore snapshot after severe failure.

## 3. Non-Goals For v1

- Final production hardware integration for every coin acceptor/printer model.
- Advanced campaign design studio.
- Full ERP/retailer POS integration.
- Complex ML optimization of campaign/prize probabilities.
- Public consumer mobile app.
- Real-time map route planning for field technicians.

## 4. Personas

### Fleet Operator

Monitors kiosk health, handles common issues, restarts services, triggers test prints, and sets maintenance mode.

### Campaign Manager

Creates, activates, schedules, pauses, and reviews campaigns across kiosks and locations.

### Technical Admin

Manages deployments, snapshots, rollback/restore, kiosk registration, security, and command permissions.

### Field Technician

Physically installs, replaces paper, fixes hardware, verifies GPS/location, and scans/enters kiosk serial number during setup.

### Brand/Marketing Viewer

Views campaign performance, plays, prize distribution, and location-level analytics without remote command authority.

## 5. Core Product Concepts

### Kiosk Identity

Each kiosk must have:

- unique kiosk id
- immutable hardware serial number
- human-readable name
- assigned location
- GPS coordinates from chip/module when available
- configured expected location
- online/offline/error/maintenance status
- current app/runtime/agent versions
- active campaign
- upcoming scheduled campaign
- last seen timestamp
- local queue length
- restore snapshot status

### Location

A retail location groups kiosks under a supermarket/store context:

- location name
- address
- supermarket brand
- timezone
- contact person
- expected GPS geofence/radius
- assigned kiosks

### Campaign

A campaign is a versioned package containing:

- brand identity
- campaign manifest
- assets
- game template
- questions
- prizes
- ticket template
- campaign rules
- legal/disclaimer notes
- start/end schedule

### Campaign Assignment

A campaign assignment defines where and when a campaign runs:

- target kiosk, group, or location
- campaign version
- start datetime
- end datetime
- priority
- fallback campaign
- timezone
- deployment/cache status

### Restore Snapshot

A restore snapshot is a known-good local software/runtime state the kiosk can restore after severe failure.

Snapshot scope should include:

- kiosk player version
- local runtime API version
- kiosk agent version
- active cached campaign packages
- service configuration
- local runtime database preservation policy

Important: restore must not destroy unsynced event data unless explicitly approved and backed up.

## 6. Functional Requirements

### FR1 — Kiosk Registration and Identity

The system must allow registering a kiosk with serial number, name, assigned location, and metadata.

Acceptance criteria:

- A kiosk cannot be registered without a unique serial number.
- Admin can assign or rename a kiosk without changing its immutable serial number.
- Kiosk heartbeats include kiosk id, serial number, software versions, active campaign, queue length, and health status.

### FR2 — GPS Location Reporting

Each kiosk should report GPS coordinates when a GPS module/chip is available.

Acceptance criteria:

- Kiosk agent reads GPS data periodically when supported.
- Heartbeat includes latitude, longitude, accuracy, and GPS timestamp.
- Admin dashboard shows last known GPS position.
- System flags kiosk when reported GPS is outside assigned location geofence.
- GPS failure does not prevent campaign play.

### FR3 — Offline Operation and Local Buffering

A kiosk must continue operating when internet is unavailable.

Acceptance criteria:

- Active campaign remains playable from local cache.
- Coin/session/spin/question/prize/print events are recorded locally.
- Local event records include durable ids, sync status, retry metadata, and timestamps.
- Local data survives process restart and system reboot.
- When internet returns, buffered events are pushed to central API.
- Central API deduplicates events using idempotency keys/local event ids.

### FR4 — Fleet Health Monitoring

The admin dashboard must show operational status for 10 to 100+ kiosks.

Acceptance criteria:

- Fleet overview shows online/offline/error/maintenance states.
- Dashboard shows last seen, active campaign, current version, GPS status, queue length, printer status, coin acceptor status, disk/RAM warnings.
- Operators can filter by location, campaign, status, and version.
- Offline kiosks remain visible with last known state.

### FR5 — Remote Commands

Authorized admins/operators must be able to send remote commands to kiosks.

Required commands:

- restart kiosk player/browser
- restart local runtime API
- restart kiosk agent
- reboot system
- test print
- upload logs
- enter maintenance mode
- resume normal mode
- deploy version
- rollback version
- restore snapshot
- refresh campaign cache

Acceptance criteria:

- Commands are authenticated, authorized, scoped, expiring, and audit-logged.
- Command lifecycle includes pending, sent, running, succeeded, failed, expired, cancelled.
- Commands sent while kiosk is offline remain pending until expiry or cancellation.
- Dangerous commands require confirmation and higher role permission.

### FR6 — Restore Snapshot / Disaster Recovery

Worst-case remote recovery must allow restoring kiosk software to a known-good snapshot.

Acceptance criteria:

- Kiosk maintains at least one previous known-good software snapshot.
- Restore command can be issued remotely by authorized admin.
- Restore process preserves or backs up unsynced event data before changing runtime state.
- After restore, kiosk reboots/restarts and returns to attract mode if hardware and campaign cache are healthy.
- Restore result is reported and audit-logged.

### FR7 — Campaign Activation

Campaign managers/admins must be able to activate a campaign remotely.

Acceptance criteria:

- Campaign can be assigned to a kiosk, location, group, or whole fleet.
- Kiosk downloads/caches campaign package before activation when online.
- Kiosk confirms campaign package checksum/version before switching.
- If activation fails, kiosk continues current or fallback campaign.

### FR8 — Calendar Campaign Scheduling

The platform must support multiple campaigns following each other according to a calendar schedule.

Acceptance criteria:

- Admin can schedule campaign A from start/end datetime and campaign B after it.
- Schedules support kiosk timezone/location timezone.
- Kiosk caches upcoming campaign package before scheduled start when possible.
- At scheduled time, kiosk switches campaign locally even if internet is temporarily unavailable, provided campaign package is cached.
- Schedule conflicts are detected before publishing.
- Fallback campaign is used if scheduled campaign is unavailable or invalid.

### FR9 — Campaign Cache Management

Kiosks must maintain local campaign packages required for current and upcoming schedules.

Acceptance criteria:

- Local runtime stores active campaign and next scheduled campaigns locally.
- Each cached package has version, checksum, status, and last validation result.
- Admin dashboard shows campaign cache readiness per kiosk.
- Kiosk refuses to activate invalid or corrupted campaign packages.

### FR10 — Audit and Analytics

Every critical user, kiosk, and admin event must be auditable.

Acceptance criteria:

- Audit log includes local event id, central id, kiosk id, campaign id, session id where applicable, timestamp, source, and payload.
- Admin commands include requesting admin, role, target kiosk/group, command payload, result, and timestamps.
- Campaign activation/schedule changes are logged.
- Analytics can answer plays per kiosk/day, print success/failure, prize distribution, campaign/location performance, and offline queue health.

## 7. Data Model Additions

### kiosks

Add/ensure fields:

- id
- serial_number unique immutable
- name
- location_id
- status
- current_player_version
- current_runtime_version
- current_agent_version
- active_campaign_id
- active_campaign_version
- next_campaign_id nullable
- last_seen_at
- last_ip
- tailnet_ip
- gps_latitude nullable
- gps_longitude nullable
- gps_accuracy_m nullable
- gps_seen_at nullable
- expected_latitude nullable
- expected_longitude nullable
- geofence_radius_m nullable
- queue_length
- restore_snapshot_id nullable
- created_at
- updated_at

### kiosk_heartbeats

- id
- kiosk_id
- serial_number
- status
- payload_json
- gps_latitude nullable
- gps_longitude nullable
- gps_accuracy_m nullable
- queue_length
- active_campaign_id nullable
- versions_json
- received_at

### campaign_assignments

- id
- campaign_id
- campaign_version
- target_type: kiosk/location/group/fleet
- target_id nullable
- active_from
- active_until
- timezone
- priority
- fallback_campaign_id nullable
- status: draft/published/active/completed/cancelled/error
- created_by_admin_id
- created_at
- updated_at

### campaign_cache_status

- id
- kiosk_id
- campaign_id
- campaign_version
- checksum
- status: missing/downloading/cached/validated/invalid/failed
- last_checked_at
- error_message nullable

### restore_snapshots

- id
- kiosk_id nullable
- version
- label
- player_version
- runtime_version
- agent_version
- campaign_cache_policy
- checksum
- status: available/active/failed/deprecated
- created_at

### device_commands

Add command types:

- restart_player
- restart_runtime
- restart_agent
- reboot_system
- test_print
- upload_logs
- enter_maintenance_mode
- resume_normal_mode
- deploy_version
- rollback_version
- restore_snapshot
- refresh_campaign_cache

### local_events / central events

Must include:

- local_event_id / idempotency_key
- kiosk_id
- session_id nullable
- campaign_id nullable
- event_type
- payload_json
- occurred_at
- sync_status local-only
- sync_attempts local-only
- central_ack_id local-only
- received_at central-only

## 8. Admin Dashboard v1 Screens

### Fleet Overview

- map/list/table view
- status filters
- location/campaign/version filters
- queue length warnings
- GPS/geofence warning
- offline duration warning

### Kiosk Detail

- identity: serial, name, location
- GPS status and last known coordinates
- active/upcoming campaign
- current versions
- local queue length
- health timeline
- recent events
- remote command panel
- restore snapshot panel
- campaign cache status

### Campaign Calendar

- schedule by kiosk/location/group/fleet
- drag/drop or form-based schedule creation
- conflict detection
- timezone handling
- fallback campaign configuration
- cache readiness status

### Remote Operations Center

- command queue
- command results
- dangerous command confirmations
- batch operations
- audit trail

### Analytics

- plays by kiosk/location/campaign/day
- coins vs completed sessions
- prize distribution
- print success/failure
- offline queue health
- campaign schedule effectiveness

## 9. Roles and Permissions

| Role | Permissions |
|---|---|
| Viewer | View fleet and analytics only |
| Operator | Restart services, test print, maintenance mode, upload logs |
| Campaign Manager | Create/schedule/activate/pause campaigns |
| Admin | Deploy, rollback, assign kiosks, manage users except superadmin |
| Superadmin | Restore snapshots, reboot systems, dangerous fleet-wide commands |

## 10. MVP Priorities

### MVP 1 — Local Runtime Reliability

- local SQLite event buffer
- offline play
- sync worker
- active campaign cache
- basic session state machine

### MVP 2 — Fleet Identity and Heartbeat

- kiosk serial/name/location
- heartbeat ingestion
- GPS fields and dashboard display
- fleet overview status

### MVP 3 — Remote Management

- restart services
- reboot system
- test print
- upload logs
- maintenance mode
- audit log

### MVP 4 — Campaign Scheduling

- campaign assignments
- calendar schedule
- upcoming campaign cache
- local scheduled switch
- fallback campaign

### MVP 5 — Restore Snapshot

- previous known-good version
- restore command
- preserve unsynced data
- restore audit result

## 11. Key Risks

| Risk | Impact | Mitigation |
|---|---:|---|
| Local data loss during restore | Critical | Backup/preserve SQLite event DB before restore |
| Duplicate events after reconnect | High | Idempotency keys based on local event ids |
| Campaign switch fails offline | High | Pre-cache upcoming campaign packages |
| GPS chip unreliable indoors | Medium | Treat GPS as telemetry, not blocker; support configured expected location |
| Dangerous remote command misuse | High | RBAC, confirmation, scoped commands, audit log |
| Fleet grows faster than realtime design | Medium | Start WebSocket/SSE; design path to MQTT/NATS |

## 12. Open Questions

1. Which GPS hardware/module will be used and how does Linux expose it: serial, USB, GPSD, or vendor API?
2. Should restore snapshot be OS-level image, Docker image rollback, filesystem snapshot, or a hybrid?
3. How long must kiosks buffer offline data before storage pressure alerts begin?
4. Should campaign schedules be centrally authored but locally evaluated, or centrally pushed as individual activation commands?
5. Do we need kiosk groups/tags from v1, or are location-based assignments enough initially?

## 13. Recommended First Technical Slice

Build the first slice around offline-safe operation and sync:

```text
local-runtime-api
  → SQLite local event/session DB
  → active campaign cache
  → sync_status on every event
  → sync worker with idempotency keys
  → /api/health exposes queue length + active campaign
```

Then add fleet identity and heartbeat:

```text
kiosk-agent
  → serial number
  → kiosk name
  → GPS telemetry
  → versions
  → queue length
  → health status
  → central heartbeat endpoint
```
