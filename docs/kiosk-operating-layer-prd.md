# Kiosk Operating Layer PRD

> **Status:** Draft v0.1 for JM review before Kanban execution  
> **Owner:** Hermes / Acmea Tech  
> **Scope:** Managed retail kiosk operating layer, local-first sync, activation package runtime, fleet operations, admin cockpit, and implementation handoff.  
> **Decision state:** Not approved for implementation yet. This document is the source for architecture/developer review and the upcoming orchestrator plan.

---

## 1. Executive Summary

Acmea should build the kiosk product as a **managed retail kiosk platform**, not a one-off fullscreen website. The strategic product is the operating layer that lets us run many branded activations safely across kiosks while preserving offline play, reliable printing, remote management, and auditability.

Core formula:

```text
Kiosk shell + activation package contract + local runtime/HAL + kiosk agent + central control plane + admin cockpit
```

The recommended v1 architecture is:

- **Kiosk player:** React + Vite + PixiJS + GSAP, fullscreen browser.
- **Local runtime:** Node.js/TypeScript + Fastify + WebSocket + SQLite, controlling sessions, token input, printer, local event log, and sync queue.
- **Hardware abstraction layer:** serial token adapter, CUPS/ESC/POS printer adapter, fake adapters for development.
- **Kiosk agent:** heartbeat, health telemetry, command polling, deployment/rollback orchestration. TypeScript acceptable for MVP; Go preferred later.
- **Central control plane:** Fastify/NestJS API, PostgreSQL, object storage, admin dashboard, audit log.
- **Sync model:** custom SQLite outbox/event upload for kiosk-generated events; versioned download/cache for packages and schedules; separate command queue lifecycle for remote operations.

Primary recommendation:

> Use **custom idempotent outbox sync** for the kiosk runtime. Do **not** use PowerSync/ElectricSQL/Replicache as the critical runtime sync engine in v1. Those are useful references and possible future tools for admin/companion apps, but the kiosk data model is simpler and more safety-critical: append-only events up, versioned config/packages down.

---

## 2. Business Goal

Build a reusable kiosk platform that can support:

- HQ pilot validation;
- Chocomel-style brand activation;
- future campaigns without rebuilding the whole kiosk;
- multi-location deployments;
- remote operations;
- reliable token/play/print flow;
- audit-grade event history;
- scalable campaign scheduling and analytics.

### Business Outcomes

| Outcome | Why it matters |
|---|---|
| Reliable retail operation | Avoid customer/staff frustration and reputational damage. |
| Reusable activation package model | Enables multiple brands/campaigns with lower marginal cost. |
| Offline-first runtime | Supermarket internet is not reliable enough to be a dependency. |
| Remote fleet management | Avoid truck rolls and manual SSH operations. |
| Analytics and audit trail | Proves ROI to brands and helps diagnose failures. |
| Controlled rollout/rollback | Protects fleet from bad updates. |

---

## 3. Product Scope

### In Scope for v1/HQ Pilot

- Fullscreen kiosk player.
- Local runtime with session state machine.
- SQLite local database.
- Fake token and fake printer adapters.
- Real token adapter abstraction for CH340/USB serial hardware.
- Real printer adapter abstraction for CUPS/ESC/POS thermal printer.
- Activation package v1 manifest.
- One example campaign package.
- Ticket/coupon generation with unique IDs.
- Local append-only event log.
- Outbox sync queue design and initial API.
- Kiosk agent heartbeat.
- Basic central API and PostgreSQL schema.
- Admin dashboard v1: fleet overview, kiosk detail, last sessions, hardware status, test print, maintenance mode.
- Basic remote command lifecycle.
- Versioned package download/cache.
- Previous known-good package preservation.
- HQ acceptance test flow.

### Explicitly Out of Scope for v1

- Full brand self-service campaign builder.
- Multi-tenant external client portal.
- Advanced GPS/geofence enforcement.
- Complex CRDT/multi-peer data replication.
- Payment processing/compliance, unless later confirmed.
- Full Kubernetes deployment.
- Native executable activation packages.
- Browser JavaScript direct access to printer, serial ports, filesystem, OS commands, or unrestricted network.

---

## 4. Operating Principles

1. **Local-first customer journey**  
   Token input, gameplay, ticket generation, printing, and reset must work without cloud connectivity.

2. **Cloud as control/reporting plane, not runtime dependency**  
   Central API manages fleet, packages, schedules, commands, and analytics, but customer interactions continue offline.

3. **Append-only operational truth**  
   Sessions, token events, prize outcomes, print requests, print results, failures, command results, and deployment events are logged append-only.

4. **Versioned everything**  
   UI, runtime, agent, activation packages, schedules, printer config, and deployment manifests must be versioned.

5. **Rollback before cleverness**  
   Every deploy path must preserve previous known-good runtime/package/schedule.

6. **Hardware control stays outside browser modules**  
   Browser/player renders and requests actions through a controlled localhost bridge. Local runtime owns hardware.

7. **Operational validation before visual polish**  
   A beautiful wheel that fails to print is a business failure.

---

## 5. System Architecture

```text
Central Control Plane
  ├── Admin Dashboard
  ├── Central API
  ├── PostgreSQL
  ├── Object Storage
  ├── Device Command Queue
  └── Audit / Analytics
          ▲
          │ HTTPS sync + command polling / future MQTT/NATS
          ▼
Kiosk Device
  ├── Kiosk Agent
  │     ├── heartbeat
  │     ├── health telemetry
  │     ├── command execution
  │     ├── deploy/rollback
  │     └── log upload
  │
  ├── Local Runtime / Hardware Bridge
  │     ├── Fastify API
  │     ├── WebSocket to player
  │     ├── SQLite local DB
  │     ├── session state machine
  │     ├── token/coin adapter
  │     ├── printer adapter
  │     ├── event outbox sync
  │     └── package/schedule cache
  │
  └── Kiosk Player
        ├── fullscreen shell
        ├── idle/attract loop
        ├── activation package loader
        ├── game/campaign UI
        └── maintenance overlay
```

---

## 6. Component Requirements

## 6.1 Kiosk Player

### Responsibilities

- Run fullscreen in kiosk browser mode.
- Render idle/attract loop.
- Load active activation package from local cache.
- Display game/campaign interaction.
- Listen to local runtime state over WebSocket.
- Request allowed bridge actions only through local runtime.
- Reset to idle after completion/timeout/failure.
- Show maintenance/degraded state when instructed by runtime.

### Non-Responsibilities

- No direct serial/printer access.
- No authoritative ticket ID generation unless delegated and validated by runtime.
- No direct central API dependency for customer sessions.
- No production debug/manual bypass controls visible to customers.

### Recommended Stack

- React + Vite.
- PixiJS for 2D/game rendering.
- GSAP for transitions/timelines.
- XState preferred for visible flow state.
- WebSocket + REST to local runtime.

---

## 6.2 Activation Package Runtime

Activation packages are versioned campaign modules.

```text
shared runtime + campaign manifest + assets + module = branded activation
```

### Package Contents

- `manifest.json`.
- HTML/CSS/JS module or bundled module assets.
- brand assets.
- game/campaign config.
- prize/coupon config.
- ticket template.
- legal copy.
- checksum manifest.
- minimum runtime/player version.

### v1 Lifecycle Contract

```text
init(context)
ready()
heartbeat()
start(payload)
event(name, data)
complete(result)
fail(reason_code, details)
pause()
resume()
stop()
```

### Controlled Bridge Calls

```text
Kiosk.recordTelemetry(eventName, payload)
Kiosk.requestPrint(ticketPayload)
Kiosk.complete(result)
Kiosk.fail(reasonCode, details)
Kiosk.getScheduleContext()
Kiosk.getRuntimeCapabilities()
```

### Package Validation

Before activation:

- manifest schema valid;
- package version present;
- runtime contract supported;
- required assets exist;
- checksums match;
- ticket template renderable;
- QR/barcode renderable if used;
- package size within limits;
- minimum runtime/player version satisfied.

---

## 6.3 Local Runtime / Hardware Bridge

### Responsibilities

- Own session state machine.
- Own token/coin handling.
- Own printer execution.
- Own local SQLite event/session/ticket database.
- Own local sync queue.
- Expose localhost-only HTTP/WebSocket API.
- Validate activation package print requests operationally.
- Preserve current and previous known-good package.
- Continue active campaign offline.

### Session State Machine

```text
booting
  → idle
  → token_received
  → session_starting
  → playing
  → result_pending
  → print_requested
  → printing
  → completed
  → resetting
  → idle
```

Failure states:

```text
degraded_printer
degraded_token_input
maintenance
package_failed
runtime_error
```

### Hardware Adapter Model

```text
hardware/
  token/
    FakeTokenAdapter
    SerialTokenAdapter
  printer/
    FakePrinterAdapter
    CupsPrinterAdapter
    EscPosPrinterAdapter
```

Each adapter must expose health status and structured errors.

---

## 6.4 Kiosk Agent

### Responsibilities

- Maintain durable kiosk identity.
- Send heartbeat.
- Report versions, active campaign, queue length, OS health, app health, hardware health.
- Poll/receive remote commands.
- Execute commands with lifecycle reporting.
- Handle deployment/rollback orchestration.
- Upload logs on demand.
- Enter/exit maintenance mode.

### Heartbeat Payload

```json
{
  "kiosk_id": "hq-001",
  "location_id": "hq",
  "agent_version": "0.1.0",
  "runtime_version": "0.1.0",
  "player_version": "0.1.0",
  "active_package": "chocomel-wheel@1.0.0",
  "schedule_version": 1,
  "uptime_seconds": 12345,
  "queue_length": 12,
  "printer_status": "online",
  "token_status": "online",
  "runtime_health": "healthy",
  "player_health": "healthy",
  "last_session_at": "...",
  "last_error": null
}
```

---

## 6.5 Central Control Plane

### Responsibilities

- Device registry.
- Location management.
- Heartbeat ingestion.
- Event ingestion with idempotency.
- Campaign/package registry.
- Schedule assignments.
- Remote command queue.
- Deployment tracking.
- Audit log.
- Admin dashboard data APIs.

### Dashboard v1 Screens

1. Fleet overview.
2. Kiosk detail.
3. Recent sessions/events.
4. Hardware health.
5. Test print / restart / maintenance commands.
6. Package/schedule status.
7. Basic analytics.
8. Audit log.

---

## 7. Sync Architecture

## 7.1 Research-Backed Decision

Local-first sync engines researched:

- **PowerSync:** strong Postgres-to-SQLite local-first sync with local SQLite reads and upload queue.
- **ElectricSQL/Electric Sync:** strong Postgres read-path sync using Shapes; writes handled separately.
- **Replicache:** browser-local sync with mutators/push/pull/poke for collaborative applications.
- **SQLite CRDT sync approaches:** useful for multi-peer conflict-free replication.

Decision:

> Use custom SQLite outbox/event sync for kiosk v1. Do not make a generic local-first sync engine part of the critical customer journey.

Reason:

- Kiosk writes are mostly append-only events.
- Campaign/schedule data flows mostly downward as versioned packages/config.
- We need auditability and deterministic recovery more than collaborative conflict resolution.
- Browser-local durable state is the wrong authority for hardware-backed retail operation.

## 7.2 Sync Channels

### Channel A — Event Upload

```text
local_events → sync_queue → central API → PostgreSQL events
```

Requirements:

- append-only;
- local ULID/UUID event IDs;
- local monotonically increasing sequence;
- idempotent central ingest;
- batch upload;
- retry/backoff;
- per-event ACK;
- dead-letter handling;
- do not delete unsynced data;
- preserve event order per session.

### Channel B — Package Download

```text
central package registry → kiosk cache → validate → stage → activate
```

Requirements:

- manifest checksums;
- versioned packages;
- previous known-good preserved;
- package activated only after validation;
- future packages cached before scheduled activation;
- failed package rolls back.

### Channel C — Schedule/Config Download

```text
central schedule version → kiosk schedule cache → safe-boundary activation
```

Requirements:

- schedule version;
- timezone;
- validity period;
- fallback package;
- cache readiness;
- safe activation after current session or slot boundary.

### Channel D — Remote Commands

```text
central command queue → kiosk agent → execution → result upload
```

Lifecycle:

```text
pending → accepted → running → succeeded / failed / expired / cancelled
```

Requirements:

- command expiry;
- auth/authorization;
- audit log;
- result evidence;
- post-command health verification.

---

## 8. Offline-for-Days Requirements

Design target:

- **Minimum 7 days offline operation** for active/scheduled cached campaigns.
- **Minimum 30 days local retention** for events and tickets.
- Unsynced records are never deleted until central ACK.

| Data | Local Retention |
|---|---:|
| Active package | Always |
| Previous known-good package | Always |
| Next packages/schedules | 7 days ahead minimum |
| Session/events | 30 days minimum |
| Ticket records | 30–90 days depending redemption value |
| Logs | 7–14 days rolling |
| Command history | 30 days |

Offline behavior:

| Feature | Offline? |
|---|---|
| Attract loop | Yes |
| Token input | Yes |
| Game/session | Yes |
| Ticket generation | Yes |
| Printing | Yes, if printer healthy |
| Event logging | Yes |
| Schedule switching | Yes, if package cached |
| New package download | No |
| Remote commands | No |
| Analytics sync | Delayed |

---

## 9. Data Model

## 9.1 Local SQLite Tables

```text
device_state
runtime_state
campaign_cache
schedule_cache
sessions
events
tickets
print_jobs
sync_queue
hardware_status
command_results
local_errors
```

### `events`

Key fields:

- `event_id` ULID/UUID primary key.
- `kiosk_id`.
- `session_id` nullable.
- `local_sequence` integer.
- `event_type`.
- `occurred_at`.
- `payload_json`.
- `schema_version`.
- `sync_status`.
- `sync_attempts`.
- `last_sync_error`.

### `tickets`

Key fields:

- `ticket_id`.
- `ticket_code` unique.
- `kiosk_id`.
- `session_id`.
- `package_id`.
- `package_version`.
- `render_payload_json`.
- `print_status`.
- `created_at`.
- `printed_at`.

## 9.2 Central PostgreSQL Tables

```text
locations
kiosks
kiosk_heartbeats
campaigns
activation_packages
campaign_schedules
sessions
events
tickets
device_commands
command_results
deployments
package_downloads
admin_users
admin_roles
admin_audit_log
```

Required uniqueness:

```sql
UNIQUE (kiosk_id, event_id)
UNIQUE (ticket_code)
UNIQUE (kiosk_id, ticket_id)
UNIQUE (command_id, kiosk_id)
```

---

## 10. Security Requirements

- Local runtime binds to `127.0.0.1` only unless explicitly required.
- Kiosk services are not exposed to supermarket LAN.
- Remote access via Tailscale/WireGuard.
- Device authentication token/certificate.
- Central commands authenticated, authorized, scoped, and expiring.
- Admin RBAC: viewer, operator, admin, superadmin.
- Signed package manifests before production rollout.
- No secrets in activation packages.
- Logs must redact secrets/tokens.
- Dangerous commands require confirmation and audit.

---

## 11. Deployment and Rollback

Artifacts:

```text
kiosk-player:<semver>
local-runtime:<semver>
kiosk-agent:<semver>
activation-package:<package>@<semver>
schedule:<id>@<version>
```

Deploy flow:

```text
download → verify checksum/signature → stage → health check → activate → monitor → promote or rollback
```

Rollback triggers:

- player fails health check;
- runtime health endpoint fails;
- package heartbeat missing;
- package validation fails;
- crash loop threshold exceeded;
- print flow fails after deploy if tied to runtime/package update;
- admin manual rollback.

Snapshot restore is emergency-only and must preserve/export unsynced local records when possible.

---

## 12. MVP Acceptance Criteria

## 12.1 Local Runtime / Player

- Kiosk boots into fullscreen idle screen.
- Fake token starts one session.
- Real token adapter can be enabled without changing player code.
- Session state transitions are logged.
- Game/campaign completes.
- Ticket is generated with unique ID.
- Fake print logs success.
- Real printer adapter can print a test ticket.
- Player resets to idle after completion.
- Browser restart does not erase local events.

## 12.2 Sync

- Events persist locally while offline.
- Events upload when central API is available.
- Duplicate upload is ignored by central API due to idempotency.
- Failed event does not block entire queue forever; it moves to dead-letter after policy threshold.
- Queue length is reported in heartbeat.

## 12.3 Package/Schedule

- Package manifest validates.
- Package downloads to local cache.
- Package activates only after validation.
- Previous package remains available.
- Schedule can point to a specific package version.
- Kiosk can continue active campaign if internet is down.

## 12.4 Admin/Fleet

- Dashboard shows kiosk online/offline.
- Dashboard shows active package and version.
- Dashboard shows queue length.
- Dashboard shows last session and last print result.
- Admin can trigger test print.
- Admin can put kiosk in maintenance mode.
- Command lifecycle status is visible.

## 12.5 HQ Physical Test

- Real kiosk boots to player.
- Real token starts session.
- User completes game.
- Real thermal ticket prints.
- Print success/failure is logged.
- Kiosk returns to idle.
- Reboot returns kiosk to ready state.
- Dashboard reflects session and health after sync.

---

## 13. Recommended Repository Structure

```text
kiosk-platform/
  apps/
    kiosk-player/
    admin-dashboard/

  services/
    local-runtime/
    kiosk-agent/
    central-api/

  packages/
    campaign-schema/
    shared-types/
    ui/

  campaigns/
    chocomel/
      manifest.json
      assets/
      module/
      ticket-template/

  infra/
    docker-compose.yml
    systemd/
    nginx/
    tailscale/
    uptime-kuma/

  docs/
    architecture.md
    kiosk-operating-layer-prd.md
    hardware-baseline.md
    deployment-runbook.md
    rollback-runbook.md
    hq-acceptance-checklist.md
```

---

## 14. Tech Stack Decision Matrix

| Layer | v1 Recommendation | Later / Production |
|---|---|---|
| OS | Linux Mint 22.3 / Ubuntu LTS | Same, hardened image |
| Process manager | systemd | systemd + watchdogs |
| Player | React + Vite | Same |
| Animation | PixiJS + GSAP | Same + Rive optional |
| Player state | XState preferred | Same |
| Local API | Node.js/TypeScript + Fastify | Go possible for runtime if needed |
| Local DB | SQLite WAL | Same |
| Token input | Node SerialPort | Go/Rust adapter if needed |
| Printer | CUPS + ESC/POS | Same |
| Kiosk agent | TypeScript for speed | Go single binary |
| Central API | Fastify or NestJS | Same; scale horizontally |
| Central DB | PostgreSQL | PostgreSQL + read replicas if needed |
| Object storage | S3-compatible | CDN/object storage |
| Commands | REST polling | MQTT/NATS for fleet |
| Dashboard | React + Vite | Same / Next.js if needed |
| Remote access | Tailscale | Same / managed VPN |
| Monitoring | Uptime Kuma + heartbeat | Prometheus/Grafana later |

---

## 15. Implementation Phases

### Phase 0 — Repo and Specification Foundation

- Create monorepo structure.
- Add this PRD and architecture docs.
- Define campaign schema package.
- Define local and central data model migrations.
- Add fake hardware adapter interfaces.

### Phase 1 — Local MVP Flow

- Build local runtime API/WebSocket.
- Build SQLite schema and append-only event writer.
- Build kiosk player idle/session/game/result/reset flow.
- Add fake token and fake printer.
- Generate local ticket IDs.
- Verify full fake token → play → fake print → reset flow.

### Phase 2 — Real Hardware HQ Flow

- Implement serial token adapter.
- Implement CUPS/ESC/POS printer adapter.
- Add printer test endpoint/command.
- Add hardware health status.
- Add systemd boot-to-kiosk.
- Verify physical token → play → print → reset → reboot recovery.

### Phase 3 — Central API and Sync

- Build PostgreSQL schema.
- Build event ingest endpoint with idempotency.
- Build heartbeat endpoint.
- Build local sync worker with retry/backoff/dead-letter.
- Build dashboard fleet/kiosk detail v1.

### Phase 4 — Package/Schedule Runtime

- Implement activation package manifest validator.
- Implement package cache/stage/activate flow.
- Implement schedule cache and safe-boundary activation.
- Add fallback known-good package.

### Phase 5 — Remote Ops and Deployment

- Implement command queue.
- Implement agent command polling/execution.
- Add test print, restart, maintenance commands.
- Add deployment/rollback records.
- Add log upload.
- Prepare staged rollout model.

---

## 16. Orchestrator Handoff Preview

After JM approval, the orchestrator should not implement directly. It should route cards to specialist lanes.

Proposed lanes:

1. **Architecture/spec lane:** finalize schema, interfaces, package contract, state machines.
2. **Local runtime lane:** SQLite, Fastify, session engine, sync outbox, fake hardware.
3. **Kiosk player lane:** React/Vite/PixiJS flow and package loader.
4. **Hardware lane:** serial token and thermal printer adapters.
5. **Central API lane:** PostgreSQL schema, ingest, heartbeat, commands.
6. **Admin dashboard lane:** fleet overview, kiosk detail, commands, status.
7. **DevOps/device lane:** systemd, Chromium kiosk mode, Docker Compose, Tailscale, health checks.
8. **QA/review lane:** HQ acceptance checklist, simulated offline tests, duplicate upload tests, physical flow when hardware available.

Dependency graph:

```text
PRD/spec finalization
  ├── local runtime foundations
  ├── player foundations
  ├── central API foundations
  └── devops scaffold

local runtime + player → fake end-to-end flow review
local runtime + hardware → physical token/print review
central API + sync worker → offline/online sync review
package runtime + scheduler → campaign package review
all lanes → HQ pilot acceptance
```

---

## 17. Open Decisions for JM

| Decision | Recommendation | Needs JM? |
|---|---|---|
| Treat token as payment? | No. Treat as free/staff/customer token unless confirmed otherwise. | Yes if payment/legal model changes. |
| v1 agent language | TypeScript for speed, Go later. | No, unless JM prefers Go now. |
| Central API framework | Fastify + PostgreSQL + Drizzle. | No, if Acmea standard accepts it. |
| Dashboard framework | React + Vite. | No. |
| First campaign | Chocomel-style activation package. | Yes for brand/content confirmation. |
| Hardware baseline | Linux + CH340 token + CUPS/ESC/POS printer. | Confirm against actual purchased devices. |
| Sync engine | Custom outbox, not PowerSync/Electric/Replicache core. | Approve architecture direction. |

---

## 18. Review Checklist

Architecture reviewer should verify:

- local-first assumptions;
- sync channel separation;
- data ownership/conflict policy;
- rollback/deployment safety;
- package runtime sandbox boundaries;
- offline-for-days design;
- security boundaries;
- scalability from one HQ kiosk to fleet.

Developer reviewer should verify:

- stack feasibility;
- repo structure;
- implementation phases;
- testability;
- fake/real hardware adapter seams;
- SQLite/PostgreSQL schema realism;
- migration path;
- CI/build/test commands to add;
- missing implementation details.

---

## 19. Source Notes

Research sources inspected during planning:

- PowerSync documentation: local SQLite client architecture, upload queue, Postgres integration.
- Electric Sync documentation: read-path Postgres sync using Shapes; separate write patterns.
- Replicache documentation: mutator/push/pull/poke model for local-first browser apps.
- AWS IoT Well-Architected Lens: controlled/reversible OTA updates, versioned artifacts, rollback capability, fleet task tracking.
- Hermes retail-kiosk-platforms skill: Acmea-specific kiosk architecture, activation package contract, local runtime/HAL, fleet ops, direct HQ rollout pattern.

---

## 20. Current Recommendation

Architecture and developer reviews are complete. Both reviews found the direction correct but **not yet implementation-ready** until the addenda below are included in the source PRD.

This v0.2 PRD incorporates the required architecture/developer review corrections as implementation guardrails. The next step is **JM review of the orchestrator plan**, then Kanban creation after approval.

No implementation should start until the reviewed PRD and orchestrator task graph are accepted.

---

# Addendum A — Architecture Review Corrections

## A1. Activation Package Sandbox and Bridge Security

### v1 Decision

Activation packages shall run inside a **sandboxed iframe** served from the local runtime/player with a restrictive Content Security Policy. They must not run as unrestricted same-window ES modules in the main kiosk player context.

### Rationale

Same-window package execution makes it too easy for buggy or malicious package code to access player internals, browser storage, network APIs, and privileged bridge methods. The iframe model gives us a clear trust boundary.

### v1 Package Execution Model

```text
Activation package iframe
  ↓ postMessage with strict schema
Kiosk player bridge mediator
  ↓ authenticated local runtime request
Local runtime policy/session/print authority
  ↓ hardware adapter
Printer/token/session/event systems
```

### Required Restrictions

- `sandbox` iframe attributes: no top-navigation, no popups, no forms unless explicitly needed.
- CSP default: `default-src 'self'`; no arbitrary remote network by default.
- No WebUSB, WebSerial, camera, microphone, clipboard, geolocation, or filesystem APIs for package modules.
- No direct package access to local runtime HTTP endpoints.
- Bridge messages must validate origin, package ID, package version, session ID, schema, and allowed method.
- All package bridge requests must be rate-limited and session-scoped.
- Package liveness is externally monitored by player/runtime timeout, not trusted self-report only.
- Package timeout/failure causes controlled `package_failed` state and fallback/maintenance behavior.

### Bridge Protocol

Each bridge message includes:

```json
{
  "bridge_version": "1",
  "message_id": "ulid",
  "package_id": "chocomel-wheel",
  "package_version": "1.0.0",
  "session_id": "ulid",
  "method": "requestPrint",
  "payload": {},
  "created_at": "iso-timestamp"
}
```

Allowed package methods v1:

- `recordTelemetry`
- `requestPrint`
- `complete`
- `fail`
- `getScheduleContext`
- `getRuntimeCapabilities`

Forbidden:

- arbitrary shell/system calls;
- direct print commands;
- direct token/session start;
- direct central API writes;
- unrestricted fetch/network;
- local file access.

---

## A2. Device Provisioning and Identity Lifecycle

### v1 Enrollment Flow

```text
1. Central admin creates kiosk registration record.
2. Central API generates short-lived bootstrap enrollment token/QR.
3. Technician installs kiosk image/runtime.
4. Kiosk agent starts in unenrolled mode.
5. Technician enters/scans enrollment token locally.
6. Agent exchanges bootstrap token for device credential.
7. Central API binds credential to kiosk_id, location_id, and device fingerprint metadata.
8. Agent stores credential in root-readable-only local file or OS keyring.
9. Kiosk begins heartbeat.
```

### Credential Requirements

- Device credentials must be unique per kiosk.
- Bootstrap tokens expire and are one-time use.
- Central API supports credential revocation.
- Credential rotation command exists before production rollout.
- If disk is cloned, central dashboard should detect duplicate device fingerprint/heartbeat conflict.
- Reinstall/hardware replacement requires admin-approved re-enrollment.

---

## A3. Offline Ticket Code Generation, Redemption, and Anti-Forgery

### v1 Decision

Ticket codes are generated locally as **signed, kiosk-scoped, offline-safe codes**.

Recommended format:

```text
<campaign-short-code>-<kiosk-short-id>-<short-ulid>-<hmac-check>
```

Example:

```text
CHO-HQ001-01JABCDEF123-7K9P
```

### Requirements

- `ticket_id` is a ULID generated locally.
- `ticket_code` includes kiosk/campaign prefix for human support.
- HMAC/check segment prevents casual forgery.
- Local runtime, not package, creates final redeemable ticket code.
- Package may propose display content; runtime signs/normalizes redeemable code.
- Central DB enforces uniqueness on `ticket_code` and `(kiosk_id, ticket_id)`.
- If central sync is delayed, printed ticket remains valid under offline redemption policy.
- Redemption model must be campaign-specific: staff visual redemption, QR scan central validation, or offline code pattern acceptance.

### Ticket Lifecycle

```text
created → print_requested → printing → printed / print_failed → synced → redeemed / expired / voided
```

Corrections are append-only events; tickets are not silently mutated without audit.

---

## A4. Local Data Durability, SQLite Policy, and Disk-Full Behavior

### SQLite Configuration

- Enable WAL mode.
- Enable foreign keys.
- Use explicit transactions for session + event + ticket + print-job writes.
- Use busy timeout.
- Checkpoint WAL on controlled intervals.
- Run migration backup/export before destructive changes.

### Storage Pressure Policy

Priority order when disk is under pressure:

1. Preserve unsynced events/tickets/command results.
2. Preserve active and previous known-good package.
3. Delete old synced log bundles.
4. Delete old synced event copies only after retention policy and central ACK.
5. Delete unused cached future packages.
6. Enter maintenance mode if safe operation cannot be guaranteed.

### Required Limits

- Maximum event payload size.
- Maximum log directory size.
- Minimum free disk threshold for accepting new sessions.
- Dead-letter is a sync state, not deletion from audit history.

---

## A5. OTA, Compatibility, Migration, and Rollback Boundaries

### Component Ownership

| Component | Owner of update | Rollback owner |
|---|---|---|
| Activation package | Kiosk agent downloads/stages; runtime validates/activates | Runtime + agent |
| Schedule/config | Runtime pulls/cache; agent reports status | Runtime |
| Kiosk player | Agent/systemd deploys and verifies | Agent |
| Local runtime | Agent deploys and verifies | Agent |
| Kiosk agent | Agent self-update only via two-phase safe update | Previous agent/systemd fallback |
| OS baseline | Manual/controlled image process | Snapshot/reimage |

### Compatibility Matrix

Activation package manifest must declare:

- `min_player_version`;
- `min_runtime_version`;
- `runtime_contract_version`;
- supported screen orientation/resolution;
- required bridge capabilities.

Runtime and player must refuse incompatible packages.

### Migration Policy

- Prefer roll-forward migrations.
- Destructive migrations require local backup/export first.
- Runtime rollback after DB migration must be explicitly tested or blocked.
- Schema version is recorded in SQLite and PostgreSQL.

---

## A6. Local Runtime API Auth

Binding to localhost is required but insufficient.

### v1 Design

- Local runtime creates a per-boot local session secret.
- Kiosk player receives secret through controlled launch/config file with restrictive permissions or injected local startup mechanism.
- WebSocket handshake requires token.
- REST endpoints require token.
- Runtime verifies `Origin`/`Host` where applicable.
- Package iframe cannot call runtime directly; package calls player bridge only.
- Admin/debug endpoints disabled in production unless maintenance mode is active and authenticated.

---

## A7. Remote Command Safety Matrix

| Command | Role | During active session? | Confirmation | Idempotency | Evidence |
|---|---|---:|---:|---:|---|
| `test_print` | Operator+ | No, unless idle | No | command_id | print result/log |
| `enter_maintenance` | Operator+ | After current session by default | Yes | command_id | state/event |
| `exit_maintenance` | Operator+ | Yes | No | command_id | state/event |
| `restart_player` | Admin+ | No; safe boundary | Yes | command_id | health after restart |
| `restart_runtime` | Admin+ | No; safe boundary | Yes | command_id | health after restart |
| `restart_agent` | Admin+ | Yes if safe | Yes | command_id | agent heartbeat |
| `reboot_device` | Admin+ | No; safe boundary | Yes | command_id | post-reboot heartbeat |
| `download_package` | Admin+ | Yes | No | package digest | cache status |
| `activate_package` | Admin+ | Safe boundary only | Yes | package version | activation status |
| `rollback_package` | Admin+ | Safe boundary / emergency | Yes | target version | activation status |
| `upload_logs` | Operator+ | Yes | No | command_id | log bundle URL |
| `revoke_device` | Superadmin | N/A | Yes | command_id | audit event |

No command may execute arbitrary shell supplied by the dashboard.

---

## A8. Fleet Scale Targets

### Pilot Target

- 1–10 kiosks.
- Heartbeat every 30 seconds.
- Event upload every 10–30 seconds or after session end.
- Batch size: 50–250 events.
- Package size target: under 100MB; hard warning above 250MB.

### First Production Target

- 100 kiosks.
- 30-second heartbeat normal; 10-second degraded mode.
- PostgreSQL indexed by `kiosk_id`, `occurred_at`, `event_type`, `session_id`.
- Consider event table partitioning once volume exceeds practical dashboard/query thresholds.
- Object storage/CDN for packages when multiple locations are pulling large assets.

---

## A9. Hardware Degraded-Mode Policy

| Failure | Behavior |
|---|---|
| Printer offline before token | Block sessions; show maintenance/degraded message. |
| Printer fails after result | Retry limited times; show staff/help message; log failure; optionally allow operator reprint. |
| Token input offline | Enter maintenance; disable customer journey. |
| Central API offline | Continue local operation if package/schedule cached. |
| Package fails to load | Roll back to previous known-good package or fallback attract loop. |
| Disk below threshold | Stop accepting new sessions; enter maintenance after logging reason. |
| Runtime unhealthy | Agent restarts runtime; if repeated failure, rollback or maintenance. |

---

## A10. Time, Clock, and Timezone Policy

- Kiosk stores location timezone.
- Schedules are evaluated using location timezone.
- Events store kiosk-local occurred timestamp and central received timestamp.
- Agent reports clock skew if detectable.
- NTP must be enabled on kiosk OS.
- If clock skew exceeds threshold, kiosk continues active sessions but schedule activation and ticket validity warnings are raised.

---

## A11. Observability and Diagnostics

Required correlation IDs:

- `session_id`;
- `ticket_id`;
- `print_job_id`;
- `command_id`;
- `deployment_id`;
- `package_id/version`;
- `kiosk_id`.

Required diagnostics bundle:

- recent runtime logs;
- recent agent logs;
- recent player console/log capture if available;
- SQLite queue summary, not raw secrets;
- current package/schedule versions;
- hardware status;
- systemd service statuses;
- disk/memory/uptime summary.

---

## A12. Admin RBAC Action Matrix

| Action | Viewer | Operator | Admin | Superadmin |
|---|---:|---:|---:|---:|
| View fleet/status | Yes | Yes | Yes | Yes |
| View analytics | Yes | Yes | Yes | Yes |
| Test print | No | Yes | Yes | Yes |
| Upload logs | No | Yes | Yes | Yes |
| Enter/exit maintenance | No | Yes | Yes | Yes |
| Restart player/runtime | No | No | Yes | Yes |
| Deploy package | No | No | Yes | Yes |
| Rollback package | No | No | Yes | Yes |
| Reboot device | No | No | Yes | Yes |
| Manage campaigns/schedules | No | No | Yes | Yes |
| Revoke device credential | No | No | No | Yes |
| Manage admin users/roles | No | No | No | Yes |

---

# Addendum B — Developer Implementation Readiness

## B1. Monorepo Toolchain Decision

Recommended v1 toolchain:

- Node.js LTS.
- `pnpm` workspaces.
- TypeScript.
- Vite for player/dashboard.
- Fastify for local runtime and central API.
- Drizzle or Kysely for typed SQL; final choice should be locked before implementation.
- Vitest for unit tests.
- Playwright for browser/player smoke tests.

Root commands to implement:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm package:validate
pnpm db:migrate:local
pnpm db:migrate:central
pnpm dev:runtime
pnpm dev:player
pnpm dev:central
pnpm dev:admin
```

---

## B2. Shared Interfaces to Define First

Create `packages/shared-types` before app/service implementation.

Required contracts:

```ts
interface TokenAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  onToken(callback: (event: TokenEvent) => void): void;
  getHealth(): Promise<HardwareHealth>;
}

interface PrinterAdapter {
  print(ticket: RenderedTicket): Promise<PrintResult>;
  testPrint(): Promise<PrintResult>;
  getHealth(): Promise<HardwareHealth>;
}

interface HardwareHealth {
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  code?: string;
  message?: string;
  checked_at: string;
}
```

Also define:

- `SessionState`;
- `EventEnvelope`;
- `Ticket`;
- `PrintJob`;
- `Command`;
- `CommandResult`;
- `HeartbeatPayload`;
- `PackageManifest`;
- `ScheduleManifest`.

---

## B3. API Route Contracts

### Local Runtime v1

```text
GET  /health
GET  /state
POST /dev/token          # fake/dev only
POST /print/test
POST /maintenance/enter
POST /maintenance/exit
GET  /ws
```

All production routes require local auth token. Dev-only routes disabled unless `HARDWARE_MODE=fake` and `NODE_ENV != production`.

### Central API v1

```text
POST /api/kiosks/:kioskId/enroll
POST /api/kiosks/:kioskId/heartbeat
POST /api/kiosks/:kioskId/events/batch
GET  /api/kiosks/:kioskId/commands
POST /api/kiosks/:kioskId/commands/:commandId/result
GET  /api/kiosks/:kioskId/schedule/current
GET  /api/packages/:packageId/:version/manifest
GET  /api/packages/:packageId/:version/download
```

---

## B4. Environment and Config Model

Each service must include `.env.example`.

Required kiosk config fields:

```text
KIOSK_ID
LOCATION_ID
CENTRAL_API_URL
DEVICE_CREDENTIAL_PATH
SQLITE_PATH
PACKAGE_CACHE_PATH
LOG_DIR
HARDWARE_MODE=fake|real
TOKEN_ADAPTER=fake|serial
TOKEN_SERIAL_PORT=/dev/ttyUSB0
PRINTER_ADAPTER=fake|cups|escpos
PRINTER_NAME=...
LOCAL_RUNTIME_PORT=8787
PLAYER_ORIGIN=http://127.0.0.1:xxxx
```

---

## B5. CI/Test Matrix

CI must include:

- install;
- typecheck;
- lint;
- unit tests;
- build all apps/services;
- package manifest validation;
- SQLite migration validation;
- PostgreSQL migration validation.

Required tests:

- session state machine;
- event append transaction;
- sync idempotency;
- duplicate event upload;
- fake token flow;
- fake printer flow;
- ticket code generation/HMAC;
- package manifest validation;
- bridge message validation;
- local API auth;
- command lifecycle;
- heartbeat payload;
- offline/reconnect queue flush;
- player idle → token → play → print → reset smoke test.

---

## B6. File-Level Implementation Sequence

### Phase 0A — Spec/Tooling Only

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
eslint/prettier config
.github/workflows/ci.yml
docs/kiosk-operating-layer-prd.md
```

### Phase 0B — Shared Contracts

```text
packages/shared-types/src/events.ts
packages/shared-types/src/session.ts
packages/shared-types/src/hardware.ts
packages/shared-types/src/tickets.ts
packages/shared-types/src/commands.ts
packages/shared-types/src/heartbeat.ts
packages/campaign-schema/src/manifest.ts
packages/campaign-schema/src/validate.ts
```

### Phase 1 — Local Runtime Fake Flow

```text
services/local-runtime/src/db/
services/local-runtime/src/events/
services/local-runtime/src/tickets/
services/local-runtime/src/session/
services/local-runtime/src/hardware/token/FakeTokenAdapter.ts
services/local-runtime/src/hardware/printer/FakePrinterAdapter.ts
services/local-runtime/src/api/
services/local-runtime/src/ws/
```

### Phase 2 — Kiosk Player Fake Flow

```text
apps/kiosk-player/src/runtime-client/
apps/kiosk-player/src/state/
apps/kiosk-player/src/screens/IdleScreen.tsx
apps/kiosk-player/src/screens/GameScreen.tsx
apps/kiosk-player/src/screens/ResultScreen.tsx
apps/kiosk-player/src/screens/MaintenanceScreen.tsx
apps/kiosk-player/src/package-runtime/
```

### Phase 3 — Central API and Sync

```text
services/central-api/src/db/
services/central-api/src/routes/heartbeats.ts
services/central-api/src/routes/events.ts
services/central-api/src/routes/commands.ts
services/local-runtime/src/sync/
```

### Phase 4 — Agent and Remote Commands

```text
services/kiosk-agent/src/identity/
services/kiosk-agent/src/heartbeat/
services/kiosk-agent/src/commands/
services/kiosk-agent/src/deploy/
services/kiosk-agent/src/logs/
```

### Phase 5 — Real Hardware

```text
services/local-runtime/src/hardware/token/SerialTokenAdapter.ts
services/local-runtime/src/hardware/printer/CupsPrinterAdapter.ts
services/local-runtime/src/hardware/printer/EscPosPrinterAdapter.ts
infra/udev/
infra/systemd/
```

### Phase 6 — Admin Dashboard

```text
apps/admin-dashboard/src/pages/FleetOverview.tsx
apps/admin-dashboard/src/pages/KioskDetail.tsx
apps/admin-dashboard/src/pages/Commands.tsx
apps/admin-dashboard/src/pages/Packages.tsx
apps/admin-dashboard/src/pages/AuditLog.tsx
```

---

## B7. Service Packaging Decision for HQ Pilot

For HQ pilot:

- Local runtime: systemd service running Node bundle.
- Kiosk agent: systemd service running Node bundle initially.
- Kiosk player: Vite static build served locally or by local runtime.
- Browser: Chromium kiosk mode pointed at local player URL.
- Central API/admin: Docker Compose in staging/server environment.

Do not use PM2 for kiosk core services unless explicitly justified; systemd gives better OS-level supervision.

---

## B8. Developer Approval Gate

Before Kanban implementation begins, the orchestrator must create cards that first produce:

1. repo/tooling skeleton;
2. shared types/contracts;
3. migration stubs;
4. package schema validator;
5. fake hardware E2E flow;
6. CI baseline.

No UI polish or real hardware integration should start until fake token → session → ticket → fake print → reset passes locally.
