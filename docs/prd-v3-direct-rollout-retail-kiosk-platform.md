# PRD v3 — Direct Rollout Retail Kiosk Activation Platform

Date: 2026-06-08  
Status: Draft for JM review  
Owner: Acmea Tech / JM  
Companion architecture note: `docs/it-architecture-components-brainstorm-2026-06-08.md`

---

## 1. Executive Summary

Build a reusable **retail kiosk activation platform** for branded in-store campaigns. The first rollout will be kept deliberately simple: deploy directly, validate at HQ by the admin/operator, capture real blockers, then patch fast.

The product is not a one-off animated kiosk page. It is a local-first, remotely manageable platform composed of:

```text
kiosk shell + activation packages + local runtime + hardware HAL + kiosk agent + central control plane + admin cockpit
```

The first acceptance gate is **HQ admin validation under operational conditions**.

---

## 2. Product Thesis

Retail brands and operators need a repeatable way to run physical promotional experiences in shops without rebuilding a custom stack for every campaign.

The platform should let Acmea/operator staff:

- deploy a branded activation package;
- run the kiosk locally even when internet is unavailable;
- accept a free/issued token or coin as a participation trigger;
- run the interaction/game;
- print a ticket/coupon/QR output;
- monitor kiosk status;
- restart, redeploy, rollback, and collect logs remotely;
- schedule future campaign modules.

---

## 3. Rollout Strategy

### 3.1 Confirmed rollout mode

```text
direct rollout → HQ admin test → blocker list → fast patch → pilot candidate
```

### 3.2 Why direct rollout

The acceptance environment is the HQ/admin operational test location. Adding a heavy staging process now would slow feedback without materially reducing risk.

### 3.3 Required safety net

Direct rollout does **not** mean reckless rollout. Minimum safety net:

- previous known-good version/package preserved;
- logs accessible;
- rollback procedure documented;
- HQ admin acceptance checklist completed;
- blocking issues captured and prioritized.

---

## 4. Goals

| Goal | Description |
|---|---|
| Local-first operation | Kiosk can run play flow and print ticket without internet if package is cached. |
| Reusable campaign runtime | Avoid hardcoded one-brand apps; use activation packages/modules. |
| Controlled hardware bridge | Token input and printer access handled by local runtime/HAL, not browser code. |
| Operational visibility | Admin can see kiosk health, active package, version, queue, and errors. |
| Direct admin validation | HQ admin can test real flow and determine rollout readiness. |
| Remote support | Restart, test print, upload logs, deploy, rollback, and maintenance mode. |
| Auditability | Sessions, tokens, tickets, print outcomes, commands, deploys, and errors are logged. |

---

## 5. Non-Goals for v1

- Full visual campaign design studio.
- Public client/brand dashboard.
- Kubernetes.
- Full MDM/RMM replacement.
- POS/payment integration.
- Complex prize inventory/compliance engine unless campaign requires it.
- Overbuilt staging/release bureaucracy before HQ test feedback.

---

## 6. Personas

| Persona | Need |
|---|---|
| Consumer | Simple instructions, responsive interaction, clear result, printed ticket. |
| HQ Admin / Operator | Validate rollout, run tests, report blockers, restart/test print if needed. |
| Fleet Operator | Monitor health, restart services, upload logs, maintain kiosks. |
| Campaign Manager | Prepare activation packages and schedules. |
| Technical Admin | Manage versions, deployments, rollback, system config, and access. |
| Field Technician | Install device, validate token/printer/network, replace paper. |

---

## 7. Core User Flow

```text
attract screen
→ token/coin inserted
→ local runtime starts session
→ activation package starts
→ user completes game/interaction
→ result generated
→ ticket/QR/coupon print requested
→ local runtime executes print through HAL
→ event/ticket logs saved
→ kiosk resets to attract screen
```

---

## 8. Functional Requirements

### 8.1 Kiosk Shell

- Load active activation package from local cache.
- Run fullscreen in kiosk mode.
- Show attract, active session, completion, error, offline, and maintenance states.
- Communicate with local runtime over localhost HTTP/WebSocket.
- Expose only a limited module bridge.
- Prevent browser/module from controlling hardware directly.

### 8.2 Activation Package

A package contains brand/module-specific assets and logic.

Minimum package contents:

- `manifest.json`
- module entrypoint HTML/JS/CSS
- assets/media
- ticket/QR output template or print payload definition
- version and campaign metadata

Minimum lifecycle:

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

### 8.3 Local Runtime API

- Own local session finite state machine.
- Receive token/coin events.
- Start and end sessions.
- Record append-only events locally.
- Create unique ticket records.
- Execute print requests through hardware HAL.
- Queue unsynced events for central sync.
- Expose health/status endpoints.
- Continue core flow offline.

### 8.4 Hardware HAL

V1 must support:

- simulated token input for development/HQ testing;
- CH340 USB serial token/coin input where available;
- CUPS thermal printing via `ICOD-PT80KM` queue;
- simulated/fake printer mode for testing if physical printer is unavailable.

### 8.5 Kiosk Agent

- Register stable kiosk identity.
- Send heartbeat to central API.
- Report app/package versions, health, queue length, last error, hardware status.
- Execute authorized remote commands.
- Upload logs.
- Support deploy and rollback.

### 8.6 Central Control Plane

- Store kiosk identities, heartbeats, events, tickets, deployments, commands, campaign packages, and schedules.
- Provide authenticated API for admin cockpit and kiosk agents.
- Store package/log bundles in object storage.
- Use PostgreSQL as canonical database.

### 8.7 Admin / Ops Cockpit

Minimum v1 cockpit:

- fleet overview;
- kiosk detail;
- active version/package;
- health/heartbeat status;
- latest events/errors;
- command queue;
- restart runtime/browser;
- test print;
- deploy package/version;
- rollback;
- log upload;
- HQ test checklist status.

---

## 9. HQ Admin Acceptance Criteria

The rollout is **not complete** until HQ admin validates these points:

| Area | Acceptance criterion |
|---|---|
| Boot | Kiosk starts into fullscreen app without manual setup. |
| Package | Correct activation package loads from local cache. |
| Token | Token/coin or simulated token starts a session. |
| Interaction | User can complete the full campaign flow. |
| Ticket | Ticket/QR/coupon print succeeds or explicit failure is logged. |
| Reset | Kiosk returns to attract screen after completion/timeout. |
| Offline | Cached package can run locally if internet is disconnected. |
| Events | Token, session, result, ticket, print, and reset events are recorded. |
| Heartbeat | Admin/control plane sees kiosk status and active version/package. |
| Remote command | Restart or test print command executes with visible result. |
| Rollback | Previous known-good version/package can be restored if needed. |

---

## 10. Architecture Requirements

Recommended v1 stack:

| Layer | Choice |
|---|---|
| Kiosk UI | Vite + React, PixiJS/GSAP where animation needs it |
| Local runtime | Node.js/Fastify or Go |
| Local DB | SQLite |
| Hardware | HAL adapters for CH340 serial token and CUPS printer |
| Agent | Lightweight service supervised by systemd |
| Central API | Custom API service |
| Central DB | PostgreSQL |
| Storage | S3-compatible object storage |
| SSL/proxy | Caddy |
| Deployment | Docker Compose + systemd |
| Monitoring support | Uptime Kuma + domain telemetry |
| Remote access | Tailscale mandatory for pilot/emergency support |

---

## 11. Data Requirements

Central database minimum:

- `locations`
- `kiosks`
- `campaigns`
- `activation_packages`
- `schedules`
- `sessions`
- `events`
- `tickets`
- `device_commands`
- `deployments`
- `admins`
- `audit_log`

Local SQLite minimum:

- `local_sessions`
- `local_events`
- `local_tickets`
- `sync_queue`
- `active_package`
- `device_state`
- `command_results`

---

## 12. MVP Slices

### Slice 1 — HQ direct rollout candidate

- Kiosk shell.
- One activation package.
- Local runtime FSM.
- Simulated token adapter.
- CUPS or fake-printer adapter.
- SQLite events/tickets.
- Basic kiosk heartbeat.
- Minimal admin/status view.
- Manual rollback procedure.

### Slice 2 — 10-kiosk pilot readiness

- CH340 serial token adapter.
- Kiosk identity/registration.
- Central PostgreSQL sync.
- Fleet overview.
- Command lifecycle.
- Package versioning.
- Log upload.
- Uptime Kuma integration.

### Slice 3 — Commercial platform foundation

- Campaign manager.
- Schedule calendar.
- Deployment center.
- Analytics.
- RBAC.
- Client/brand viewer.
- Restore/snapshot workflow after unsynced-data safety is proven.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Direct rollout discovers blocker at HQ | Fast patch path + rollback to previous known-good version. |
| Test validates visuals only | Require token/play/print/log checklist. |
| Browser controls printer/token | Enforce local runtime/HAL boundary. |
| Offline event loss | SQLite append-only event/ticket logs + sync queue. |
| Duplicate tickets | Unique ticket records/constraints. |
| Manual SSH becomes normal ops | Use dashboard commands; reserve Tailscale/SSH for emergency. |
| Overbuilt platform slows pilot | Keep v1 to direct rollout/HQ validation requirements. |
| Underbuilt platform fails operations | Do not skip rollback, logging, ticket uniqueness, and hardware bridge. |

---

## 14. Success Metrics

### HQ rollout success

- Admin completes acceptance checklist.
- No blocking issue remains open.
- Full token → play → print → reset path works.
- Rollback path is known and testable.

### Pilot success

- 10 kiosks can be identified and monitored.
- Heartbeats and operational status visible centrally.
- Tickets/events sync with no silent loss.
- Operator can resolve common issues remotely.
- Campaign package can be updated without rewriting kiosk runtime.

---

## 15. Open Questions for JM

1. Should v1 package outcomes be fully module-owned, or should the local runtime own prize selection for the first pilot?
2. Is the token always a free participation trigger, or can any deployment become payment-like later?
3. Does HQ admin need a web dashboard for the first test, or is a minimal status/checklist page enough?
4. Should the first package be hard-bound to the current brand activation, or should it already follow the generic manifest schema?
5. Is screenshot/snapshot evidence mandatory for HQ acceptance or only pilot support?

---

## 16. Recommendation

Approve this v3 PRD direction for direct rollout. The architecture is intentionally simple where commodity infrastructure exists, and strict where kiosk operations can fail: local state, hardware bridge, ticket uniqueness, logging, remote commands, and rollback.

The immediate next execution step is to turn Slice 1 into implementation issues/tasks and use HQ admin testing as the operational acceptance gate.
