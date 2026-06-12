# IT Architecture Components Brainstorm — Retail Kiosk Activation Platform

Date: 2026-06-08  
Status: Architecture-first draft before PRD consolidation  
Owner: Acmea Tech / JM  
Source basis: grill-questionnaire decisions, existing v2 PRD, pilot hardware baseline, and direct-rollout decision for HQ admin testing.

---

## 1. Executive Direction

Before finalizing the PRD, we should lock the IT architecture components. The product is not a single branded game. It is a **managed retail activation platform** that can run downloadable campaign modules on physical kiosks, under remote operational control, while preserving local-first operation.

The current rollout posture is intentionally simple:

```text
direct rollout → HQ admin test → collect blockers → fast patch → confirm pilot readiness
```

This means the architecture should support direct operational deployment without creating an oversized staging bureaucracy. But it still needs rollback, logs, and a known-good recovery path. Simple is good. Blind is not.

---

## 2. Architectural Thesis

```text
Shared kiosk shell
+ local runtime/hardware bridge
+ activation package/module contract
+ kiosk agent
+ central control plane
+ admin operations cockpit
= reusable remotely managed activation fleet
```

The platform value comes from repeatability:

- one runtime;
- many campaign packages;
- controlled hardware access;
- local event/ticket persistence;
- central visibility;
- direct rollout with evidence-based HQ validation.

---

## 3. Component Map

```text
┌────────────────────────────────────────────────────────────────────┐
│                         Admin / Ops Cockpit                         │
│ fleet · schedules · packages · deploy · rollback · logs · analytics │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                          Central Control Plane                      │
│ API · auth/RBAC · PostgreSQL · object storage · command queue       │
└───────────────────────────────┬────────────────────────────────────┘
                                │ heartbeat / sync / commands / assets
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                              Kiosk Device                           │
│                                                                    │
│  ┌──────────────────────┐   local WS/HTTP   ┌───────────────────┐ │
│  │ Fullscreen Kiosk UI   │◄────────────────►│ Local Runtime API  │ │
│  │ Shell + module host   │                  │ FSM + SQLite       │ │
│  └──────────┬───────────┘                  └─────────┬─────────┘ │
│             │ module lifecycle/bridge calls            │           │
│             ▼                                          ▼           │
│  ┌──────────────────────┐                  ┌───────────────────┐ │
│  │ Activation Package    │                  │ Hardware HAL       │ │
│  │ HTML/CSS/JS module    │                  │ token · printer    │ │
│  └──────────────────────┘                  └───────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Kiosk Agent                                                   │  │
│  │ identity · heartbeat · commands · deploy · rollback · logs    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Linux Mint · Docker Compose/systemd · Tailscale · CUPS · SQLite   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Responsibilities

### 4.1 Fullscreen Kiosk UI / Shell

**Purpose:** Render the consumer-facing activation in fullscreen kiosk mode.

Responsibilities:

- Attract screen and idle loop.
- Load the active activation package from local cache.
- Provide a constrained JS bridge to the activation module.
- Render game/interaction visuals.
- Show maintenance/offline/error states.
- Never directly control token hardware, printers, OS commands, or deployment.

Recommended stack:

- Vite + React for shell/state/UI.
- PixiJS + GSAP for premium 2D animation.
- Browser kiosk mode under systemd supervision.

### 4.2 Activation Package / Downloadable Module

**Purpose:** Brand/campaign-specific interactive experience.

V1 package format should stay simple:

```text
manifest.json
index.html
assets/*
module.js
optional styles/media
```

Minimum module lifecycle:

```text
init(context)
ready()
start(payload)
event(name, data)
complete(result)
fail(reason_code, details)
pause()
resume()
stop()
heartbeat()
```

Allowed bridge calls:

- `Kiosk.recordTelemetry(...)`
- `Kiosk.printTicket(...)`
- `Kiosk.complete(...)`
- `Kiosk.fail(...)`
- `Kiosk.getScheduleContext(...)`

Blocked in v1:

- arbitrary OS commands;
- direct serial/USB access;
- direct CUPS/printer access;
- external network dependencies required for play completion;
- native executables or containers inside packages unless explicitly approved later.

### 4.3 Local Runtime API

**Purpose:** Source of truth for local sessions, token input, prize/ticket lifecycle, and event persistence.

Responsibilities:

- Finite state machine for kiosk session flow.
- Accept token/coin events from HAL.
- Open/close module play window.
- Validate print requests operationally.
- Write append-only local events.
- Create unique ticket records.
- Queue unsynced events for central sync.
- Expose local WebSocket/HTTP API to kiosk UI.
- Continue operating without internet.

Recommended stack:

- Node.js/Fastify or Go.
- SQLite local database.
- WebSocket for UI updates.
- REST endpoints for diagnostics/health.

### 4.4 Hardware HAL

**Purpose:** Controlled adapter layer for physical token input and ticket printing.

V1 hardware targets:

| Hardware | V1 requirement |
|---|---|
| Token/coin acceptor | CH340 USB serial via stable `/dev/serial/by-id/...` path, fallback `/dev/ttyUSB0` |
| Printer | CUPS queue `ICOD-PT80KM`, fallback `PT80KM` if configured |
| Simulated adapters | Required for development, HQ testing, and fallback diagnostics |

HAL responsibilities:

- Normalize token/coin events.
- Debounce/validate pulse or serial input.
- Report hardware health.
- Execute print jobs through CUPS.
- Return print success/failure with reason codes.
- Never let browser/module directly touch hardware.

### 4.5 Kiosk Agent

**Purpose:** Device-level operational agent for fleet management.

Responsibilities:

- Persistent kiosk identity.
- Heartbeat to central API.
- Report versions, active package, queue length, disk/RAM/CPU, uptime, printer status, token status, last session, last error.
- Receive authorized remote commands.
- Execute command lifecycle:

```text
pending → acknowledged → running → succeeded / failed / expired / cancelled
```

V1 command set:

- restart kiosk UI/browser;
- restart local runtime;
- reboot device;
- test print;
- upload logs;
- maintenance mode / resume;
- deploy package/app version;
- rollback to previous known-good version.

Restore snapshot is not a normal v1 operation unless the device-image strategy is explicitly confirmed.

### 4.6 Central Control Plane

**Purpose:** Canonical system of record and command/sync endpoint.

Responsibilities:

- Kiosk registration and identity.
- Heartbeat ingestion.
- Event sync with idempotency.
- Ticket/prize records.
- Campaign/package metadata.
- Schedule assignment.
- Command queue.
- Deployment records.
- Admin auth/RBAC.
- Audit logging.

Recommended stack:

- PostgreSQL canonical DB.
- Central API service.
- S3-compatible object storage for package bundles, media, and log bundles.
- Caddy for SSL/reverse proxy.
- Docker Compose for v1 deployment.

### 4.7 Admin / Operations Cockpit

**Purpose:** Operate the fleet without SSH as the normal workflow.

Minimum screens:

1. Fleet overview.
2. Kiosk detail.
3. Command queue.
4. Package/campaign manager.
5. Schedule calendar.
6. Deployment center.
7. Rollback/log evidence view.
8. Analytics.
9. Audit log.
10. User/RBAC management.

Direct rollout implication:

- For HQ testing, the dashboard can begin as a lightweight internal cockpit.
- The first acceptance criterion is operational evidence, not visual polish.

---

## 5. Data Components

Core central tables:

| Table | Purpose |
|---|---|
| `locations` | Retail/HQ locations and groups |
| `kiosks` | Kiosk identity, assignment, active status |
| `campaigns` | Brand/campaign definitions |
| `activation_packages` | Versioned package metadata and bundle refs |
| `schedules` | Campaign/program calendars |
| `sessions` | Consumer play sessions |
| `events` | Append-only operational and gameplay events |
| `tickets` | Unique printed/redeemable ticket lifecycle |
| `device_commands` | Remote command lifecycle |
| `deployments` | App/package rollout records |
| `admins` / `roles` | Access control |
| `audit_log` | Immutable admin/system change trail |

Core local SQLite tables:

- `local_sessions`
- `local_events`
- `local_tickets`
- `sync_queue`
- `active_package`
- `device_state`
- `command_results`

---

## 6. Deployment Model

V1 should avoid over-complex infrastructure while retaining rollback.

Recommended deploy units:

```text
kiosk-ui:<semver>
kiosk-runtime:<semver>
kiosk-agent:<semver>
activation-package:<campaign-slug>@<semver>
```

Kiosk device deployment:

- Linux Mint 22.3 baseline.
- Docker Compose for runtime services where practical.
- systemd supervision for kiosk browser/agent and Docker Compose lifecycle.
- Tailscale mandatory for emergency access.
- Uptime Kuma push/HTTP monitoring as supporting alerting.
- Local `current` and `previous` version pointers.

Direct rollout workflow:

1. Package build.
2. Deploy to HQ kiosk/admin test device.
3. Health check runtime + UI + agent.
4. Run token → play → ticket print test.
5. Inspect event/ticket logs.
6. If blocker: rollback/patch.
7. If accepted: mark version as pilot candidate.

---

## 7. HQ Admin Acceptance Checklist

The HQ admin test should validate real operating conditions, not merely that the page loads.

Minimum checklist:

| Test | Acceptance signal |
|---|---|
| Kiosk boots to fullscreen app | No manual browser setup required |
| Token/coin trigger works | Session starts only after token input/simulated token in test mode |
| Activation module loads | Correct campaign appears from local package/cache |
| Interaction completes | User can finish the game/flow without dead-end |
| Ticket prints | CUPS queue prints a valid ticket or records explicit print failure |
| Reset works | Kiosk returns to attract state after completion/timeout |
| Offline behavior | Local play and print still work when internet is unavailable, if package cached |
| Event logging | Session, token, result, ticket, reset are recorded locally |
| Heartbeat | Central/admin sees kiosk online and version/package state |
| Remote action | Admin can restart runtime/browser or run test print with logged result |
| Rollback | Previous known-good version/package can be restored if rollout fails |

---

## 8. MVP Slicing Recommendation

### Slice 1 — HQ direct rollout candidate

Must include:

- kiosk shell;
- one activation package;
- local runtime FSM;
- simulated token adapter;
- CUPS printer adapter or fake printer with logged print result if hardware unavailable;
- SQLite local events/tickets;
- basic kiosk agent heartbeat;
- minimal admin status page or central endpoint;
- manual deploy/rollback procedure documented.

### Slice 2 — Pilot readiness for 10 kiosks

Add:

- CH340 serial token adapter;
- kiosk registration/identity;
- central PostgreSQL sync;
- admin fleet overview;
- command lifecycle;
- package versioning;
- schedule assignment;
- log upload;
- Uptime Kuma integration.

### Slice 3 — Commercial platform foundation

Add:

- campaign manager;
- schedule calendar;
- analytics;
- role-based access;
- client/brand viewer;
- richer deployment center;
- restore/snapshot workflow after unsynced-data safeguards are proven.

---

## 9. Key Risks and Architecture Controls

| Risk | Control |
|---|---|
| HQ test only verifies visuals | Require token/play/print/log reset checklist |
| Direct rollout breaks field device | Keep previous known-good version and rollback command/procedure |
| Browser/module controls hardware | Force all hardware through local runtime/HAL |
| Lost tickets/events during network outage | SQLite local persistence + idempotent sync queue |
| Duplicate ticket codes | Ticket table with unique constraint and deterministic lifecycle |
| Manual SSH becomes normal ops | Admin command lifecycle + Tailscale only for emergency |
| Overbuilt v1 | Use Docker Compose/systemd/Uptime Kuma/Caddy; defer Kubernetes/full observability |
| Underbuilt v1 | Do not skip local-first, event log, ticket uniqueness, and rollback |

---

## 10. Recommendation

Proceed in this order:

1. Use this architecture component map as the baseline.
2. Convert it into a revised PRD section structure.
3. Keep the PRD business-facing, but preserve architecture non-negotiables.
4. Define HQ admin acceptance as the v1 gate.
5. Avoid expanding into a full enterprise IoT platform before the 10-kiosk pilot proves the demand.

Strategic judgement: **architecture-first is the better next move before final PRD polish.** The PRD will be stronger if it is grounded in the actual deployable components, command lifecycle, local-first constraints, and HQ acceptance checklist.
