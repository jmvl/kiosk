# Admin Dashboard PRD Brainstorm v2 — Kiosk Administration, Redeploy & Recovery

Date: 2026-06-04  
Owner: Acmea Tech / JM  
Status: Brainstorming draft  
Scope: Admin dashboard capabilities for operating, administering, redeploying, recovering, and auditing a fleet of retail activation kiosks.

---

## 1. Executive Framing

The admin dashboard is not a passive reporting screen. It is the **operations cockpit** for a kiosk fleet.

Its job is to let Acmea/operator staff answer, in under 30 seconds:

1. Which kiosks are healthy?
2. Which kiosks are making money or generating plays?
3. Which kiosks need human attention?
4. What campaign/version is each kiosk running?
5. Can I safely restart, redeploy, rollback, or restore a kiosk without sending someone onsite?
6. Did the command actually execute, and what evidence proves it?

The dashboard must therefore combine:

- fleet monitoring;
- campaign operations;
- software deployment;
- remote command execution;
- restore/recovery;
- logs and evidence;
- analytics;
- audit and role governance.

---

## 2. Product Goal

Build an admin dashboard that allows operators and admins to manage the **10-kiosk v1 pilot** and scale toward 100+ kiosks across retail locations, with reliable remote administration and redeployment workflows.

Confirmed v1 dashboard assumptions:

- Tailscale is mandatory for pilot kiosk emergency access, but SSH/VPN remains an emergency path rather than the normal product workflow.
- Uptime Kuma is recommended for managed deployments and central endpoint/push monitoring, but the dashboard remains the source of truth for kiosk-specific state.
- Screenshot/snapshot monitoring is approved for v1 support and deployment evidence.
- Brand/client viewer access is deferred until after the internal v1 dashboard stabilizes.

The dashboard must support both:

- **daily operations:** monitor health, test printer, restart services, inspect sessions, enter maintenance mode;
- **release operations:** deploy new software/campaign versions, staged rollout, health checks, rollback, restore snapshot.

---

## 3. Admin Dashboard Personas

| Persona | Main intent | Can do | Cannot do by default |
|---|---|---|---|
| Viewer | See fleet and campaign performance. | View fleet, analytics, campaign status. | Send commands, edit campaigns, deploy. |
| Operator | Keep kiosks operational. | Restart player/runtime, test print, upload logs, maintenance/resume. | Deploy software, restore snapshot, manage users. |
| Campaign Manager | Manage brand campaigns. | Create/edit/publish campaigns, schedule campaigns, inspect cache readiness. | Reboot fleet, restore device snapshots. |
| Admin | Manage devices and releases. | Register kiosks, assign locations, deploy/rollback versions, run batch operations. | Superadmin-only destructive actions. |
| Superadmin | Handle high-risk recovery and governance. | Restore snapshot, fleet-wide reboot, user/role management, destructive reset if ever allowed. | N/A |
| Brand Viewer | Client/reporting access. | View approved campaign analytics and uptime summaries. | See internal logs, command controls, device secrets. |

---

## 4. Top-Level Navigation Proposal

The dashboard should be organized by operational job, not by database table.

```text
Overview
Fleet
Kiosks
Campaigns
Calendar
Deployments
Operations
Analytics
Audit
Settings
```

| Section | Purpose | Primary users |
|---|---|---|
| Overview | Executive operational summary. | Admin, Operator, JM |
| Fleet | Table/map of all kiosks with status and filters. | Operator, Admin |
| Kiosks | Individual kiosk detail and administration. | Operator, Admin, Technician |
| Campaigns | Campaign packages, assets, rules, validation. | Campaign Manager |
| Calendar | Scheduled campaign assignments by kiosk/location/group/fleet. | Campaign Manager, Admin |
| Deployments | Software/campaign rollout, redeploy, rollback. | Admin |
| Operations | Command queue, batch actions, incidents, maintenance. | Operator, Admin |
| Analytics | Plays, coins, prizes, tickets, uptime, location performance. | Campaign Manager, Viewer |
| Audit | Admin actions, device commands, campaign changes, ticket anomalies. | Admin, Superadmin |
| Settings | Users, roles, locations, kiosk groups, integrations. | Admin, Superadmin |

---

## 5. Core Screens and Requirements

### 5.1 Operations Overview

**Purpose:** immediate health and risk summary.

Widgets:

- total kiosks online/offline/warning/error/maintenance;
- current active campaigns;
- unsynced event queue total;
- print failures today;
- kiosks by software version;
- deployments in progress;
- commands pending/running/failed;
- incidents requiring action;
- top performing locations today.

Critical interactions:

- click any metric to filtered list;
- show “needs attention” as the main queue;
- avoid vanity metrics dominating operational warnings.

Acceptance criteria:

- Operator can identify the top 5 kiosks needing attention within 30 seconds.
- Dashboard distinguishes offline, warning, error, and maintenance clearly.
- Every summary metric links to evidence rows.

---

### 5.2 Fleet View

**Purpose:** operate at fleet scale.

Table columns:

| Column | Notes |
|---|---|
| Status | Online/offline/warning/error/maintenance/retired. |
| Kiosk | Human-readable name + immutable serial. |
| Location | Store/location + region/group. |
| Active campaign | Campaign name/version. |
| Next campaign | Next scheduled campaign and start time. |
| Software versions | Player/runtime/agent. |
| Last seen | Relative + exact timestamp. |
| Queue | Unsynced event count. |
| Printer | ready/low paper/error/unknown. |
| Coin acceptor | ready/disabled/error/unknown. |
| GPS/geofence | ok/drift/no signal/unknown. |
| Current state | attract/playing/printing/error/maintenance. |
| Actions | Open detail, maintenance, test print, restart. |

Filters:

- status;
- campaign;
- version;
- location;
- group/region;
- queue length threshold;
- hardware status;
- last seen threshold;
- geofence warning;
- deployment cohort.

Batch actions:

- assign campaign;
- refresh campaign cache;
- enter maintenance mode;
- resume normal mode;
- upload logs;
- deploy version;
- rollback version;
- reboot, restricted and high-friction.

Acceptance criteria:

- Fleet view supports 100+ kiosks without becoming unreadable.
- Batch actions require target preview, count, confirmation, permissions, and audit reason.
- Offline kiosks remain visible with last known telemetry.

---

### 5.3 Kiosk Detail

**Purpose:** single-device command center.

Recommended layout:

```text
Header: Kiosk name, serial, status, location, last seen, active campaign

Left/main column:
- Live state card
- Health timeline
- Recent sessions/events
- Hardware status
- Campaign cache status
- Command history

Right action rail:
- Safe actions
- Maintenance actions
- Deployment actions
- Recovery actions
```

Sections:

#### Identity

- kiosk ID;
- immutable serial number;
- human-readable name;
- assigned location;
- group/region/customer;
- expected geofence;
- tailnet/VPN IP if available;
- install date;
- hardware model/config.

#### Health

- last heartbeat;
- current local state;
- player/runtime/agent service health;
- CPU/RAM/disk;
- uptime;
- local queue length;
- clock skew;
- network status;
- GPS status;
- printer status;
- coin acceptor status.

#### Live Operations

Actions split by risk level:

| Risk | Actions | Confirmation |
|---|---|---|
| Low | test print, upload logs, refresh status, refresh campaign cache | single click + audit event |
| Medium | restart player, restart runtime, enter maintenance, resume | confirmation modal |
| High | reboot system, deploy version, rollback version | typed confirmation + reason |
| Critical | restore snapshot, destructive factory reset if ever added | superadmin + typed confirmation + optional second approval |

#### Evidence panel

Every action should show:

- command ID;
- requested by;
- requested at;
- expires at;
- lifecycle status;
- agent acknowledgment;
- started/completed at;
- stdout/log summary if relevant;
- final health check result;
- linked log bundle if uploaded.

#### Screenshot/snapshot evidence

Screenshot/snapshot capture is approved for v1 support workflows.

Requirements:

- support on-demand snapshot from kiosk detail;
- optionally support periodic snapshots per kiosk/group if enabled;
- attach snapshots to deployment health checks, failed command investigations, and support incidents where useful;
- store metadata: kiosk ID, timestamp, active campaign, player/runtime/agent version, command/deployment ID if applicable;
- make privacy behavior explicit: snapshots should avoid unnecessary consumer-identifiable data and should be disable-able per client/location if required.

Acceptance criteria:

- An operator can send a test print and see pass/fail evidence.
- An admin can redeploy one kiosk and know whether it passed health checks.
- A failed command gives actionable failure reason, not only “failed”.

---

### 5.4 Deployment Center

**Purpose:** manage software release lifecycle for kiosk player, local runtime, and kiosk agent.

Core concepts:

- release version;
- component versions: `player`, `runtime`, `agent`;
- changelog;
- release artifact/checksum;
- compatibility constraints;
- target cohort;
- rollout strategy;
- health checks;
- rollback target;
- deployment audit trail.

Deployment workflow:

```text
Draft release
→ Validate artifacts/checksums
→ Select targets/cohort
→ Preflight checks
→ Deploy to canary kiosk
→ Health check
→ Expand rollout
→ Monitor
→ Complete or rollback
```

Preflight checks:

- kiosk online or eligible for queued deploy;
- sufficient disk space;
- agent version supports deploy command;
- current local queue backed up or safe;
- active session not in progress, or schedule deployment for idle window;
- target campaign package compatibility;
- restore/previous version available.

Health checks after deploy:

- agent heartbeat reports new version;
- local runtime `/health` ok;
- kiosk player loads attract screen;
- campaign cache valid;
- printer status available;
- no critical errors in first N minutes;
- optional screenshot/snapshot from kiosk player.

Rollout modes:

| Mode | Purpose |
|---|---|
| Single kiosk | Debug/fix one device. |
| Canary | Deploy to 1–3 representative kiosks. |
| Location rollout | Deploy store by store. |
| Cohort rollout | Deploy by hardware model/version/group. |
| Fleet rollout | Deploy all eligible devices. Requires superadmin or admin with policy approval. |

Acceptance criteria:

- Admin can redeploy a kiosk without SSH.
- Admin can see current/target/previous versions per component.
- Failed deploy automatically offers rollback path.
- Rollout can be paused, resumed, or cancelled.
- Every deploy has a command/audit record and health result.

---

### 5.5 Redeploy and Rollback UX

Redeploy must be treated as a workflow, not a button.

#### Redeploy modal/wizard

Steps:

1. Select target: kiosk/location/group/fleet.
2. Select release version.
3. Show compatibility and risk summary.
4. Run preflight checks.
5. Choose execution timing: now, maintenance window, when idle, queued until online.
6. Confirm with typed release/version and reason.
7. Show live lifecycle.

#### Rollback modal/wizard

Steps:

1. Select target and component: player/runtime/agent/all.
2. Show current version and previous known-good version.
3. Show local queue preservation status.
4. Confirm rollback.
5. Execute and verify health.
6. Record incident note.

Acceptance criteria:

- Redeploy cannot start if no rollback target exists, unless superadmin overrides with reason.
- Rollback does not wipe local events/tickets.
- Commands expire cleanly if kiosk remains offline.

---

### 5.6 Restore & Recovery Center

**Purpose:** worst-case recovery after bad deploy/corruption.

Restore should be rare and high-friction.

Restore workflow:

```text
Open incident
→ Confirm kiosk state and last heartbeat
→ Upload/preserve local logs and event queue if possible
→ Select restore snapshot
→ Confirm destructive/non-destructive scope
→ Execute restore
→ Reboot/restart
→ Verify health
→ Sync restore audit event
→ Close incident
```

Safety rules:

- v1 restore is non-destructive by default;
- local events, sessions, tickets, command logs must be preserved or exported first;
- restore cannot run during active paid session unless kiosk is already in critical failure state;
- destructive factory reset is out of v1 unless explicitly approved by JM later.

Recovery views:

- snapshot inventory;
- current snapshot status;
- previous restore attempts;
- unsynced data preservation status;
- post-restore health status;
- incident notes.

Acceptance criteria:

- Superadmin can trigger restore only with reason and explicit confirmation.
- Restore result is auditable even if central sync happens later.
- Dashboard clearly distinguishes rollback from restore.

---

### 5.7 Campaign Operations

Campaign management and redeploy interact but are different concerns.

Campaign package states:

```text
draft → validated → published → assigned → cached → active → completed/retired
```

Campaign dashboard should show:

- campaign name/client;
- current version;
- asset/checksum validation;
- assigned kiosks/locations;
- cache readiness;
- active schedule;
- fallback campaign;
- performance summary;
- validation errors.

Campaign operations:

- publish campaign version;
- assign to kiosk/location/group/fleet;
- schedule campaign;
- refresh campaign cache;
- force fallback;
- pause campaign;
- retire campaign version.

Acceptance criteria:

- Campaign changes are versioned.
- Active campaign edits create a new version, not mutation in place.
- Kiosk switches only to validated cached package.

---

### 5.8 Campaign Calendar

**Purpose:** schedule campaign activation across locations and kiosks.

Calendar views:

- by location;
- by kiosk;
- by campaign;
- by week/month;
- conflict view;
- cache readiness view.

Schedule fields:

- campaign version;
- target type: kiosk/location/group/fleet;
- start/end datetime;
- timezone;
- priority;
- fallback campaign;
- cache required before start;
- status.

Offline behavior:

- kiosk keeps local schedule copy;
- if next campaign is cached and valid, kiosk switches at scheduled time offline;
- if not cached, kiosk continues current/fallback and reports cache failure later.

Acceptance criteria:

- Dashboard blocks conflicting schedules unless priority/fallback resolves conflict.
- Operator can see which kiosks are not ready for tomorrow’s campaign.

---

### 5.9 Operations Command Queue

**Purpose:** central visibility of all remote actions.

Command lifecycle:

```text
pending → sent → acknowledged → running → succeeded
                                      ↘ failed
pending/sent/running → expired/cancelled
```

Command list fields:

- command ID;
- type;
- target;
- requested by;
- role;
- reason;
- status;
- created at;
- expires at;
- acknowledged at;
- completed at;
- result summary;
- linked logs/evidence.

Command requirements:

- idempotency key;
- expiration;
- role permission;
- target scope;
- audit record;
- cancellation if not yet running;
- retry policy only where safe.

Acceptance criteria:

- Admin can distinguish command not yet delivered vs delivered but failed.
- Offline kiosk commands remain pending until expiry.
- Repeated commands do not duplicate dangerous effects.

---

## 6. Administration & Redeploy Requirement Table

| Requirement | Description | Priority | Notes |
|---|---|---:|---|
| ADM-001 | Fleet overview with health, version, campaign, queue, hardware status. | P0 | Core operations view. |
| ADM-002 | Kiosk detail page with identity, heartbeat, events, hardware, commands. | P0 | Needed before field pilot. |
| ADM-003 | Remote command lifecycle with evidence and audit. | P0 | Must not be a fire-and-forget button. |
| ADM-004 | Test print command with test-ticket labeling. | P0 | First practical hardware diagnostic. |
| ADM-005 | Maintenance mode and resume. | P0 | Prevents paid sessions during service. |
| ADM-006 | Upload logs command and log bundle viewer. | P0 | Enables remote support. |
| ADM-007 | Redeploy single kiosk release version. | P0 | Minimum remote deployment. |
| ADM-008 | Health checks after redeploy. | P0 | Required to trust deployment. |
| ADM-009 | Rollback to previous known-good version. | P0 | Required before rollout beyond prototype. |
| ADM-010 | Batch deploy by location/group/cohort. | P1 | Needed as fleet grows. |
| ADM-011 | Canary rollout and staged deployment. | P1 | Safer releases. |
| ADM-012 | Restore snapshot workflow. | P1 | Critical recovery, but after rollback. |
| ADM-013 | Campaign package cache readiness dashboard. | P0 | Prevents scheduled activation failures. |
| ADM-014 | Campaign calendar with conflict detection. | P1 | Multi-campaign value. |
| ADM-015 | RBAC and dangerous action confirmations. | P0 | Security and accountability. |
| ADM-016 | Audit log for all admin/device changes. | P0 | Non-negotiable. |
| ADM-017 | Incident notes and resolution timeline. | P1 | Useful for support discipline. |
| ADM-018 | Brand/client analytics viewer. | P2 | Commercial reporting layer. |

---

## 7. Deployment Data Model Brainstorm

### `releases`

```text
id
version
label
changelog
status: draft/validated/published/deprecated/blocked
player_version
runtime_version
agent_version
artifact_url
artifact_checksum
created_by
created_at
published_at
```

### `deployments`

```text
id
release_id
target_type: kiosk/location/group/fleet
target_id nullable
strategy: single/canary/location/cohort/fleet
status: draft/preflight/running/paused/succeeded/failed/rolled_back/cancelled
started_by
reason
started_at
completed_at
```

### `deployment_targets`

```text
id
deployment_id
kiosk_id
current_versions_json
target_versions_json
previous_versions_json
preflight_status
command_id
status
health_check_status
rollback_available
error_message
created_at
updated_at
```

### `health_checks`

```text
id
kiosk_id
deployment_target_id nullable
check_type: heartbeat/runtime/player/campaign/printer/queue/logs
status: passed/failed/warning/skipped
payload_json
checked_at
```

### `log_bundles`

```text
id
kiosk_id
command_id nullable
storage_url
checksum
size_bytes
from_time
until_time
created_at
```

---

## 8. UX Principles for This Dashboard

1. **Operational clarity beats visual drama.** Status, risk, and next action must be obvious.
2. **Dangerous actions are workflows.** Redeploy, rollback, reboot, restore are not single-click buttons.
3. **Every action needs evidence.** Command lifecycle, health check, logs, and audit trail are first-class UI elements.
4. **Default to safe action hierarchy.** Low-risk actions visible; high-risk actions gated and contextual.
5. **Batch operations must preview blast radius.** Show affected kiosk count, locations, campaigns, versions, offline targets.
6. **Offline is normal.** UI must show queued, expired, and last-known states without panic.
7. **Explain failures in operator language.** “Printer not reachable over USB” beats “EIO”.
8. **No SSH as a product dependency.** SSH is emergency backdoor, not the normal admin workflow.

---

## 9. Open Questions for JM / Client

| Topic | Question | Default recommendation |
|---|---|---|
| Deployment stack | Docker Compose or direct systemd services on kiosk? | Docker Compose for app services, systemd for agent/supervision. |
| Remote access | Tailscale/WireGuard mandatory? | Yes for emergency access, but dashboard should not depend on manual SSH. |
| Release artifact | Docker images, tarball, or git pull? | Versioned Docker images/tarballs with checksum, not git pull in production. |
| Deploy timing | Deploy immediately or only idle/maintenance windows? | Default to when idle or maintenance window. Emergency override gated. |
| Rollback scope | Rollback player/runtime/agent independently or all together? | Support component rollback, but v1 can roll back release bundle. |
| Restore tech | Filesystem snapshots, image restore, or app-level restore? | Start app-level known-good release restore. Add OS snapshots later if needed. |
| Printer diagnostics | Need paper-low sensor support in v1? | Nice to have if hardware supports it, not blocker. |
| Screenshot monitoring | Should kiosk send live screenshots/snapshots? | Approved for v1 support/deployment evidence; on-demand first, periodic optional. |
| Brand access | Can clients log in? | Later/post-v1; internal dashboard first. |

---

## 10. Proposed PRD Sections to Add/Expand

1. **Admin Dashboard Overview**
2. **Roles and Permissions**
3. **Fleet View Requirements**
4. **Kiosk Detail Requirements**
5. **Remote Command Lifecycle**
6. **Deployment Center Requirements**
7. **Redeploy Workflow**
8. **Rollback Workflow**
9. **Restore Snapshot Workflow**
10. **Campaign Cache and Scheduling Readiness**
11. **Audit and Evidence Requirements**
12. **Failure States and Operator Copy**
13. **Data Model for Deployments and Commands**
14. **Acceptance Criteria**
15. **Risks and Mitigations**

---

## 11. MVP Slice Recommendation

For the first dashboard iteration, build only what proves remote operation:

### Dashboard MVP 1

- Fleet overview table.
- Kiosk detail page.
- Heartbeat/status ingestion.
- Remote command queue.
- Test print command.
- Restart player/runtime command.
- Maintenance/resume command.
- Upload logs command.
- Basic audit log.

### Dashboard MVP 2

- Single-kiosk redeploy.
- Release/version model.
- Preflight checks.
- Health checks.
- Rollback to previous release.

### Dashboard MVP 3

- Batch/canary deployment.
- Campaign cache readiness.
- Campaign calendar readiness warnings.
- Restore snapshot workflow simulation.

### Dashboard MVP 4

- Brand analytics viewer, if JM accelerates external reporting after internal dashboard stabilizes.
- Incident management.
- Advanced deployment cohorts.

Note: screenshot/snapshot support is approved and should be included earlier where it supports kiosk detail, deployment health checks, or remote support evidence.

---

## 12. CEO Assessment

The admin dashboard is the operational moat of the kiosk platform. A pretty kiosk game can be copied quickly. A dashboard that can monitor, redeploy, recover, audit, and prove every kiosk action across supermarket locations is much harder to replicate and far more valuable to clients.

The PRD should therefore define the dashboard around **fleet reliability and redeployment discipline** before adding visual analytics polish.

If we get this right, Acmea can sell not just a campaign activation, but a managed activation network.
