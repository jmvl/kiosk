# Proposal: Fleet Campaign Scheduling and Remote Kiosk Management

## Intent

Build the first serious product-management layer for operating a retail kiosk fleet from 10 kiosks to 100+ kiosks.

The platform must treat every kiosk as a managed asset with durable identity, GPS telemetry where available, remote command execution, campaign scheduling, rollback/restore recovery, and offline-safe campaign activation.

## Why

A single kiosk prototype can be operated manually. A fleet cannot.

Once multiple retail locations are live, operational failure modes become business risks:

- a kiosk moves or is installed at the wrong location;
- a campaign starts late or the wrong campaign runs in-store;
- a kiosk is offline but still collecting paid sessions;
- operators cannot reboot, recover, or diagnose devices remotely;
- a bad deployment bricks kiosks without a safe rollback path;
- event data is lost during restore or outage recovery.

The strategic asset is therefore not only the kiosk game. It is a controllable, auditable fleet platform that allows Acmea Tech to sell and operate branded retail campaigns with predictable service quality.

## Scope

### In Scope

- Kiosk durable identity: immutable serial number, human-readable name, assigned location, group, status, current versions, active campaign, and last-seen metadata.
- GPS telemetry: heartbeat includes coordinates, accuracy, timestamp, and GPS health where hardware supports it.
- Fleet dashboard requirements: monitor 100+ kiosks with filters for status, location, campaign, version, queue health, and warnings.
- Remote command lifecycle: reboot, restart services, refresh campaign cache, upload logs, test print, maintenance mode, deploy/rollback, and restore snapshot.
- Campaign scheduling: calendar-based activation across a kiosk, location, group, or fleet with timezone, priority, fallback, conflict detection, and cache readiness.
- Offline-safe campaign activation: scheduled campaign switches continue locally when the next campaign is already cached.
- Restore/recovery: reboot or restore to a known-good snapshot while preserving unsynced local event data.
- Audit trail: every remote command, schedule publication, restore event, and failed operation is recorded.

### Out of Scope For This Change

- Final admin dashboard visual design.
- Final GPS hardware model selection.
- Production-grade MDM procurement.
- Real coin/printer hardware integration.
- Full cloud hosting decision.
- Implementation of every API endpoint; this change defines the requirements and implementation tasks.

## Proposed Architecture Direction

```text
Central Control Plane
  ├── Kiosk Registry
  ├── Campaign Catalog
  ├── Campaign Scheduler
  ├── Remote Command Queue
  ├── Fleet Telemetry Store
  └── Admin Dashboard

Kiosk Device
  ├── Kiosk Agent
  │   ├── serial/name/location identity
  │   ├── heartbeat + GPS telemetry
  │   ├── remote command executor
  │   ├── log upload
  │   └── restore/rollback trigger
  ├── Local Runtime API
  │   ├── active campaign cache
  │   ├── local schedule evaluator
  │   ├── paid session state machine
  │   └── durable event buffer
  └── Kiosk Player
      └── fullscreen campaign UI
```

## Success Criteria

- The OpenSpec change validates with `openspec validate`.
- Requirements clearly cover serial identity, GPS, remote operations, scheduling, restore, and offline-safe behavior.
- Implementation tasks are concrete enough for phased delivery.
- The first implementation slice can be built without overbuilding the whole fleet platform.

## Recommended First Implementation Slice

Start with the operational spine:

1. `kiosks` registry table/model.
2. `kiosk-agent` heartbeat endpoint.
3. local runtime queue length and active campaign reporting.
4. central command table and lifecycle model.
5. minimal campaign schedule model.
6. admin/API view of fleet status.

This gives us control-plane visibility before investing heavily in dashboard polish. Fleet discipline first; cosmetics second. Dry, but profitable.
