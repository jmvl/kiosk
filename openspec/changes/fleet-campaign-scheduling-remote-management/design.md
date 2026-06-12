# Design: Fleet Campaign Scheduling and Remote Kiosk Management

## Architecture Overview

This change introduces the fleet management/control-plane layer around the existing local-first kiosk runtime.

The guiding principle is: **central plans, kiosk executes safely**.

The central control plane owns canonical fleet state, campaign schedules, command authorization, and audit records. The kiosk owns local execution, cached campaign availability, paid session continuity, and durable event buffering.

## Core Components

### 1. Kiosk Registry

Canonical model for every physical kiosk.

Suggested fields:

```text
id
serial_number immutable unique
name
location_id
location_name
group_ids
expected_latitude
expected_longitude
geofence_radius_meters
status: provisioning/online/offline/warning/error/maintenance/retired
active_campaign_id
next_scheduled_campaign_id
local_queue_length
player_version
runtime_version
agent_version
last_seen_at
last_ip nullable
created_at
updated_at
```

The serial number is immutable. The name can change.

### 2. Kiosk Agent

Small host-level daemon/service responsible for fleet operations that the browser and local runtime should not own.

Responsibilities:

- register kiosk identity;
- send heartbeat telemetry;
- read GPS module where available;
- report service versions and health;
- execute authorized remote commands;
- upload logs;
- initiate reboot, rollback, or restore snapshot workflows;
- report command result.

The agent should run under systemd and should be restartable independently from the kiosk player and local runtime API.

### 3. Heartbeat and Telemetry

Heartbeat payload should include:

```text
serial_number
kiosk_id
name
status
active_campaign_id
current_schedule_id nullable
local_queue_length
player_version
runtime_version
agent_version
gps: latitude/longitude/accuracy/timestamp/status nullable
services: player/runtime/agent health
last_command_id nullable
storage_free_bytes optional
memory/cpu optional later
```

GPS is operational telemetry, not a hard dependency. Indoor retail environments may produce poor signal. A GPS failure must never stop paid campaign operation.

### 4. Campaign Scheduler

The central scheduler publishes schedule entries to targeted kiosks.

Schedule fields:

```text
id
campaign_id
campaign_version
target_type: kiosk/location/group/fleet
target_id nullable
starts_at
ends_at
timezone
priority
fallback_campaign_id
cache_required_before_start boolean
status: draft/published/active/completed/cancelled/failed
created_by
published_at
```

The kiosk runtime keeps a local copy of relevant schedules and cached campaign packages. At runtime it evaluates the current local schedule and switches only to campaigns that are present, valid, and compatible.

### 5. Remote Command Queue

Commands are created centrally and executed by the kiosk agent.

Command lifecycle:

```text
pending → sent → acknowledged → running → succeeded
                                      ↘ failed
pending/sent/running → expired/cancelled
```

Initial commands:

```text
restart_player
restart_runtime_api
restart_agent
reboot_system
test_print
upload_logs
enter_maintenance_mode
resume_normal_mode
refresh_campaign_cache
deploy_version
rollback_version
restore_snapshot
```

All commands require authorization, expiration, idempotency, audit logging, and result reporting.

### 6. Restore Snapshot

Restore is the nuclear option for bad deployments or corrupted kiosk runtime state.

Required safety behavior:

1. pause new paid sessions if possible;
2. flush or back up unsynced local events;
3. record restore intent locally;
4. restore application/runtime snapshot;
5. reboot/restart services;
6. verify health;
7. resume attract mode if campaign cache and hardware are healthy;
8. sync restore audit event when connectivity allows.

Restore must not wipe the durable event buffer unless JM explicitly approves a destructive factory reset workflow later.

## Data Boundaries

### Central source of truth

- kiosk registry;
- schedule definitions;
- campaign catalog metadata;
- command authorization and audit trail;
- synced operational telemetry history.

### Kiosk source of truth while offline

- active cached campaign package;
- current paid session state;
- local event buffer;
- local command execution log;
- local schedule copy relevant to that kiosk.

## Operational Risks

| Risk | Mitigation |
|---|---|
| GPS unreliable indoors | Treat as telemetry/warning, not campaign blocker. |
| Bad campaign schedule published | Conflict detection, fallback campaigns, local validation before switch. |
| Bad deployment bricks kiosk | Rollback command and restore snapshot workflow. |
| Command replay/duplication | Command idempotency keys and command state machine. |
| Offline kiosk misses schedule update | Cache upcoming campaigns and schedules before activation; fallback if missing. |
| Restore destroys unsynced data | Mandatory backup/flush step before restore. |

## Implementation Sequencing

1. Kiosk registry and heartbeat contract.
2. Kiosk agent skeleton with simulated telemetry.
3. Remote command table and lifecycle.
4. Campaign schedule model and API.
5. Local schedule cache/evaluator in runtime API.
6. Admin/fleet status API endpoints.
7. Restore/rollback skeleton with safe no-op simulation.
8. Real systemd/reboot/restore integration after simulated command path is proven.
