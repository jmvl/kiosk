# PRD Planning & Architecture — Retail Kiosk Activation Platform v2

Date: 2026-06-04  
Owner: Acmea Tech / JM  
Status: Planning draft  
Purpose: Prepare the structure, architecture, assumptions, and decision framework required to produce a strong PRD for the kiosk platform.

---

## 1. Product Framing

### Working Product Name

**Retail Kiosk Activation Fleet & Campaign Platform**

### Product Statement

Build a reusable platform for branded supermarket/retail kiosk activations that can operate locally without internet, manage coin/game/ticket flows safely, and scale from a pilot of 1–10 kiosks to a managed fleet of 100+ kiosks across locations.

### Strategic Positioning

This is not a single Chocomel wheel game. It is a **managed retail activation infrastructure product**:

```text
Local-first kiosk runtime + campaign packages + fleet control plane = reusable brand activation platform
```

The PRD must therefore cover:

- consumer kiosk experience;
- local hardware/payment/ticket reliability;
- central campaign management;
- fleet monitoring and remote operations;
- analytics and auditability;
- deployment, rollback, and disaster recovery.

---

## 2. PRD Objectives

The PRD should answer five executive questions:

| Question | PRD must define |
|---|---|
| What are we building? | A managed retail kiosk fleet and campaign platform, starting with coin/spin/quiz/ticket activations. |
| Who uses it? | Consumers, fleet operators, campaign managers, admins, field technicians, brand/reporting viewers. |
| Why is it valuable? | Faster campaign rollout, reduced on-site support, reliable paid activation flow, campaign analytics, reusable multi-brand platform. |
| How does it work operationally? | Kiosks run locally, sync centrally, receive schedules/commands, preserve data through outages. |
| What makes v1 shippable? | Offline play, durable ticket/event logging, kiosk identity/heartbeat, basic admin view, command lifecycle, campaign package model. |

---

## 3. Scope Boundaries

### In Scope for PRD v1

- 10-kiosk pilot baseline.
- Linux Mint 22.3 kiosk OS with existing installed drivers.
- Wi-Fi + Ethernet networking, with LTE card support as a spike/check item.
- Mandatory Tailscale remote access for pilot kiosks.
- Screenshot/snapshot support for remote support and deployment evidence.
- Kiosk player application for vertical touchscreen display.
- Local backend/runtime API.
- Coin acceptor and thermal printer abstraction.
- SQLite local event/session/ticket store.
- Campaign manifest/package model.
- Central API/control plane with PostgreSQL.
- Admin dashboard MVP.
- Kiosk agent for heartbeat and remote commands.
- Remote restart/reboot/test print/log upload/maintenance mode.
- Campaign assignment and calendar scheduling.
- Local campaign cache and offline scheduled switch.
- Restore/rollback design with unsynced data preservation.
- Analytics and audit event model.

### Out of Scope for PRD v1

- Brand/client viewer dashboards for external login/reporting. Internal admin reporting remains in scope; external brand access is later/post-v1 unless JM explicitly accelerates it.
- Full visual campaign design studio.
- Full retailer POS integration.
- Complex payment methods beyond coin/pulse/acceptor abstraction.
- Advanced ML prize optimization.
- Consumer mobile app.
- Field technician route optimization.
- Multi-tenant enterprise billing model, unless JM decides this becomes SaaS immediately.

---

## 4. Architecture Principles

| Principle | Meaning | Why it matters |
|---|---|---|
| Local-first | Coin acceptance, game flow, prize decisioning, ticket issuance, and event logging must work without internet. | Supermarket connectivity is unreliable; outage must not kill revenue or user experience. |
| Backend owns truth | Browser renders; local backend owns session state, prize result, coin credit, ticket state. | Prevents cheating, duplicate tickets, and state corruption. |
| Campaign-driven | Brand/copy/assets/prizes/questions/ticket templates live in versioned campaign packages. | Enables multiple brands without rewriting app code. |
| Fleet-managed | Every kiosk has identity, heartbeat, health, location, version, queue, commands. | Makes 10–100+ kiosks operationally manageable. |
| Audit-first | Every coin/session/spin/answer/prize/ticket/admin/deploy event is append-only logged. | Protects financial, operational, and client reporting integrity. |
| Recovery-safe | Rollback/restore must preserve unsynced sessions/events/tickets. | Prevents losing customer/financial records during recovery. |
| Hardware-safe | Browser never talks directly to coin acceptor/printer. | Keeps hardware reliability in controlled backend/agent services. |
| Secure by default | Local services bind locally; remote commands are authenticated, scoped, expiring, audited. | Kiosks live on hostile/shared retail networks. |

---

## 5. Target System Architecture

```text
                         ┌──────────────────────────────┐
                         │        Admin Dashboard        │
                         │ fleet · campaigns · commands │
                         │ analytics · audit · recovery │
                         └───────────────┬──────────────┘
                                         │ HTTPS/Auth
                                         ▼
                         ┌──────────────────────────────┐
                         │        Central API            │
                         │ PostgreSQL · object storage   │
                         │ schedules · events · commands│
                         └───────────────┬──────────────┘
                                         │
             heartbeat / event sync / campaign packages / commands
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                           Kiosk Device                            │
│                                                                  │
│  ┌──────────────────────┐      WS/HTTP      ┌─────────────────┐ │
│  │ Kiosk Player          │◄────────────────►│ Local Runtime API│ │
│  │ React + PixiJS/GSAP   │                  │ FSM + SQLite     │ │
│  │ fullscreen browser    │                  │ event/ticket DB  │ │
│  └──────────────────────┘                  └────────┬────────┘ │
│                                                      │          │
│                                             ┌────────▼────────┐ │
│                                             │ Hardware HAL     │ │
│                                             │ coin · printer   │ │
│                                             └─────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Kiosk Agent                                                 │  │
│  │ identity · heartbeat · GPS · remote commands · logs         │  │
│  │ deploy/rollback/restore · service supervision integration   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Linux mini-PC · systemd/Docker · Chromium/Firefox kiosk mode    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Architecture Table

| Component | Responsibility | Key data owned | Interfaces | PRD requirements to capture | MVP priority |
|---|---|---|---|---|---:|
| Kiosk Player | Consumer-facing fullscreen UI: attract, coin prompt, wheel, quiz, prize, ticket status, maintenance/error screens. | UI state only; no authoritative coin/prize/ticket state. | WebSocket/HTTP to Local Runtime API. | 1080x1920 portrait UX, accessible touch targets, reconnect behavior, no dev bypass in production. | P1 |
| Local Runtime API | Authoritative paid session/game/ticket state machine. Local API for player. Offline event buffer. | sessions, local_events, tickets, campaign cache state, active schedule snapshot. | Localhost HTTP/WebSocket; sync to Central API; HAL calls. | Offline operation, FSM, duplicate-ticket prevention, idempotent sync, health/status endpoint. | P0 |
| Hardware HAL | Abstract coin acceptor and thermal printer. Simulated and physical adapters. | Hardware status/last errors. | Local Runtime API calls/events; device serial/GPIO/USB/ESC-POS. | Coin lifecycle, printer lifecycle, test print, failure codes, physical model support matrix. | P0 |
| Kiosk Agent | Device identity, heartbeat, GPS, remote command executor, logs, deployment/rollback/restore. | local agent config, command execution log, service versions, telemetry. | Central API heartbeat/commands; systemd/Docker; OS APIs; GPS module. | Serial/name/location, GPS telemetry, command lifecycle, restore safety, log upload. | P0 |
| Central API | Canonical backend/control plane. Auth, fleet state, schedules, events, commands, analytics APIs. | kiosks, locations, campaigns, assignments, commands, synced events, admins. | Admin Dashboard; Kiosk Agent; Local Runtime sync; object storage. | Auth/RBAC, idempotent ingestion, schedule publishing, command authorization/audit. | P0 |
| PostgreSQL | Canonical durable cloud database. | registry, schedules, commands, events, tickets, analytics aggregates. | Central API only. | Data retention, indexes, unique constraints, audit integrity. | P0 |
| Object Storage | Campaign assets, package bundles, log bundles, restore artifacts if needed. | images/video/audio/fonts, campaign zip/tar packages, logs. | Central API signed URLs; kiosk download/cache. | Checksums, versioning, cache readiness, access control. | P1 |
| Admin Dashboard | Fleet overview, kiosk detail, campaigns, schedules, commands, analytics, audit. | No primary ownership; UI over Central API. | HTTPS to Central API. | Fleet table, command panel, campaign calendar, analytics, roles. | P1 |
| Campaign Package | Versioned brand/campaign definition. | manifest, assets, questions, prizes, ticket template, rules. | Loaded by Local Runtime + Player. | Schema, validation, checksums, fallback campaign, legal content. | P0 |
| Deployment/Recovery Layer | Versioned releases, rollback, restore snapshot. | current/previous versions, snapshot metadata, recovery logs. | Kiosk Agent + systemd/Docker + Central API. | Safe rollback, destructive factory reset explicitly out of v1 unless approved. | P1 |

---

## 7. Core User Journeys for PRD

### 7.1 Consumer Play Journey

1. Consumer approaches kiosk.
2. Attract screen explains promotion.
3. Consumer inserts required coin/credit.
4. Local backend validates credit and unlocks session.
5. Consumer spins wheel.
6. Backend determines prize/rule result; frontend animates to result.
7. Consumer answers quiz or completes required interaction.
8. Backend creates durable ticket record.
9. Printer prints ticket.
10. Session completes and resets.
11. Events sync centrally when connectivity exists.

### 7.2 Offline Operation Journey

1. Internet connection drops.
2. Kiosk continues active cached campaign.
3. Events/tickets/sessions persist locally with sync status.
4. Admin dashboard marks kiosk offline/stale after heartbeat timeout.
5. Connection returns.
6. Kiosk syncs buffered events idempotently.
7. Dashboard updates queue length and health.

### 7.3 Campaign Scheduling Journey

1. Campaign Manager publishes campaign version.
2. Admin schedules campaign to kiosk/location/group/fleet.
3. Kiosks download/cache package and verify checksum.
4. Dashboard shows readiness.
5. At scheduled local time, kiosk switches campaign if cache is valid.
6. If invalid/missing, kiosk runs fallback campaign and reports error.

### 7.4 Remote Recovery Journey

1. Kiosk reports printer error/offline queue/disk warning or stops heartbeating.
2. Operator opens kiosk detail.
3. Operator issues scoped command: test print, restart player, restart runtime, upload logs, or maintenance mode.
4. Kiosk Agent executes command and reports lifecycle.
5. If unrecovered, Admin issues rollback/restore command.
6. Restore preserves/exports unsynced events before system state changes.
7. Kiosk returns to attract/maintenance state and reports result.

---

## 8. Data Model for PRD

### Central Tables

| Table | Purpose | Critical constraints |
|---|---|---|
| `locations` | Retail/store locations. | Timezone and geofence required for scheduled operations. |
| `kiosks` | Device registry and current state. | Immutable unique serial number. |
| `kiosk_heartbeats` | Telemetry history. | Append-only; indexed by kiosk/time. |
| `campaigns` | Campaign identity. | Brand/customer ownership. |
| `campaign_versions` | Immutable campaign package versions. | Checksum and status required. |
| `campaign_assets` | Asset metadata and storage refs. | Versioned and checksummed. |
| `campaign_assignments` | Schedule targeting. | Conflict detection by target/time/priority. |
| `campaign_cache_status` | Per-kiosk readiness. | Must show missing/downloading/validated/invalid/failed. |
| `sessions` | Synced play sessions. | Kiosk/local session IDs preserved. |
| `tickets` | Voucher/prize ticket records. | Unique ticket code; print lifecycle. |
| `events` | Canonical synced event stream. | Idempotency key unique per kiosk/local event. |
| `device_commands` | Remote command queue. | Lifecycle, expiry, role/audit required. |
| `deployments` | Rollout/rollback state. | Version and target tracking. |
| `restore_snapshots` | Known-good recovery metadata. | Must declare local-data preservation policy. |
| `admins` / `roles` | Admin users and RBAC. | Dangerous commands require elevated role. |

### Local SQLite Tables

| Table | Purpose | Must survive reboot? |
|---|---|---:|
| `local_sessions` | Current and recent game sessions. | Yes |
| `local_events` | Append-only event buffer with sync status. | Yes |
| `local_tickets` | Durable ticket lifecycle and print attempts. | Yes |
| `campaign_cache` | Active/upcoming campaign packages and checksums. | Yes |
| `local_schedule_cache` | Relevant schedule copy for offline switch. | Yes |
| `command_log` | Commands received/executed locally. | Yes |
| `hardware_status` | Printer/coin health snapshots. | Prefer yes |
| `agent_config` | Kiosk ID/serial/API endpoint/token refs. | Yes |

---

## 9. PRD Functional Requirement Map

| ID | Requirement group | Decision needed in PRD | Acceptance criteria theme |
|---|---|---|---|
| FR1 | Kiosk identity/registration | How kiosks are provisioned and named. | Unique serial, assigned location, heartbeat identity. |
| FR2 | Consumer gameplay | Exact paid play flow and reset/error handling. | No frontend-only prize/ticket logic. |
| FR3 | Local-first operation | What continues offline. | Active campaign playable; durable local buffering. |
| FR4 | Ticket issuance | Voucher uniqueness and print lifecycle. | No duplicate tickets; print failure/retry flow. |
| FR5 | Hardware integration | Coin/printer interface support in v1. | Simulated HAL + selected physical adapters. |
| FR6 | Event/audit logging | Required events and retention. | Every financial/game/admin event append-only logged. |
| FR7 | Campaign package model | Manifest fields, validation, versioning. | Package checksum, local validation, fallback. |
| FR8 | Campaign scheduling | Targeting and conflict model. | Kiosk/location/group/fleet schedules; timezone aware. |
| FR9 | Fleet monitoring | Dashboard fields and warning thresholds. | Online/offline/error, queue length, hardware/GPS/version. |
| FR10 | Remote commands | Allowed commands and permission levels. | pending/sent/running/succeeded/failed/expired/cancelled. |
| FR11 | Deployment/rollback | Release strategy. | current/previous versions and health-gated rollback. |
| FR12 | Restore snapshot | Disaster recovery behavior. | Preserve unsynced data before restore. |
| FR13 | Analytics | Brand/operator reports. | Plays, coins, prizes, prints, location performance, queue health. |
| FR14 | Security/RBAC | Roles, auth, network exposure. | Scoped commands, audit, local services not public. |

---

## 10. Milestone Plan to Produce the PRD

### Phase 0 — Confirm Business and Hardware Assumptions

**Goal:** remove ambiguity before productizing.

Confirmed assumptions:

- Pilot target: 10 kiosks.
- First kiosk OS/hardware baseline: Linux Mint 22.3 "Zena" with installed drivers.
- Coin acceptor: CH340 USB serial adapter, stable path `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`.
- Printer: ICOD/PT80KM USB thermal printer through CUPS queue `ICOD-PT80KM`.
- Network: Wi-Fi + Ethernet; LTE card support to be checked/spiked.
- Remote access: Tailscale mandatory.
- Uptime Kuma: recommended for managed deployments and central endpoint/push monitoring, not a hard product dependency.
- Screenshot/snapshot support: approved for support and deployment evidence.
- Brand/client viewer: later/post-v1.

Remaining questions to answer:

- First country/market and currency?
- Display resolution and orientation: assume 1080x1920 portrait unless changed.
- Will users pay money for play, or is coin a promotional token/engagement mechanic?
- What legal text is required on ticket and screen?
- Who redeems tickets: cashier, promoter, customer service desk?

Deliverable:

- PRD assumptions section.
- Hardware assumptions table.
- Open questions list for JM/client.

### Phase 1 — PRD Skeleton

**Goal:** create the actual PRD structure.

Sections:

1. Executive summary.
2. Goals and non-goals.
3. Personas.
4. User journeys.
5. Functional requirements.
6. Non-functional requirements.
7. Architecture overview.
8. Data model.
9. Admin dashboard requirements.
10. Security/RBAC.
11. Analytics and reporting.
12. MVP sequence.
13. Risks and mitigations.
14. Open questions.
15. Acceptance criteria.

Deliverable:

- `docs/prd-v2-retail-kiosk-platform.md`

### Phase 2 — Architecture Spec

**Goal:** separate technical architecture from product requirements, so the PRD remains readable.

Deliverable:

- `docs/architecture-v2.md`

Must include:

- component diagram;
- local vs central source of truth;
- state machine;
- event taxonomy;
- sync protocol;
- command lifecycle;
- campaign package lifecycle;
- deployment/rollback/restore lifecycle.

### Phase 3 — Data & Event Contract

**Goal:** define durable data before UI polish.

Deliverable:

- `docs/data-contract-v1.md`

Must include:

- central PostgreSQL schema draft;
- local SQLite schema draft;
- event names and payloads;
- ticket lifecycle;
- idempotency strategy;
- retention strategy.

### Phase 4 — Admin UX Requirements

**Goal:** define what operators actually need to manage kiosks.

Deliverable:

- `docs/admin-dashboard-prd-v1.md`

Screens:

- Fleet Overview;
- Kiosk Detail;
- Campaign Calendar;
- Campaign Package Manager;
- Remote Operations Center;
- Analytics;
- Audit Log;
- User/Roles.

### Phase 5 — MVP Implementation Plan

**Goal:** convert PRD into executable work packages.

Deliverable:

- `docs/plans/mvp-implementation-plan.md`

Milestones:

1. Local runtime state machine + SQLite.
2. Campaign package schema + Chocomel package.
3. Kiosk player consuming campaign manifest.
4. Ticket lifecycle and simulated printer.
5. Kiosk identity + agent heartbeat.
6. Central API + PostgreSQL.
7. Fleet dashboard MVP.
8. Remote command lifecycle.
9. Campaign scheduling/cache.
10. Deployment/rollback/restore simulation.

---

## 11. Recommended MVP Architecture Sequence

| Sequence | Build first | Why |
|---:|---|---|
| 1 | Local Runtime API FSM + SQLite event/ticket store | Protects money/session/ticket integrity. |
| 2 | Campaign manifest schema and one Chocomel package | Prevents hardcoded one-off campaign. |
| 3 | Kiosk Player reading manifest | Allows branded UI without code changes. |
| 4 | Simulated Hardware HAL fully reliable | Enables demo/testing without physical devices. |
| 5 | Physical HAL spike for selected coin/printer | Confirms hardware risk early. |
| 6 | Kiosk Agent heartbeat/identity | Starts fleet management. |
| 7 | Central API/PostgreSQL sync endpoints | Creates canonical platform. |
| 8 | Admin dashboard fleet view | Makes operations visible. |
| 9 | Remote command lifecycle | Reduces field support. |
| 10 | Campaign scheduling/cache/offline switch | Enables multi-campaign commercial value. |
| 11 | Rollback/restore workflow | Makes fleet support credible. |

---

## 12. Acceptance Criteria for the PRD Itself

The PRD is complete when it can answer these without interpretation:

- What exactly happens when a coin is inserted?
- Who decides the prize and when?
- What prevents duplicate tickets?
- What happens if printing fails?
- What happens if internet is down for 48 hours?
- How does a kiosk know which campaign to run today?
- What happens if tomorrow’s campaign is not cached?
- How does an operator know a kiosk is broken?
- Which remote commands exist and who can run them?
- What happens if a reboot command is sent while offline?
- What data must be preserved before restore?
- What can be shown to a brand after a campaign ends?
- What is v1, and what is explicitly not v1?

---

## 13. Key Decisions Needed from JM

| Decision | Default recommendation | Why |
|---|---|---|
| Product framing | Fleet & campaign platform, not one-off kiosk game. | Higher long-term value and repeatability. |
| Runtime stack | React/Vite + PixiJS frontend; Node/Fastify or Go local backend; PostgreSQL central API. | Fast MVP, robust enough for fleet. |
| Deployment model | Docker Compose + systemd on kiosk; Caddy/Docker for central services. | Matches Acmea operating preferences. |
| Hardware strategy | Simulated HAL plus CH340 USB serial coin acceptor and ICOD/PT80KM CUPS thermal printer. | Matches confirmed pilot hardware while preserving testability. |
| Scheduling model | Central schedule, local cached execution. | Preserves offline behavior. |
| Restore policy | Non-destructive restore only in v1. | Protects unsynced data and audit trail. |
| MVP success metric | 10-kiosk pilot readiness: one kiosk can run full paid simulated + physical CH340/CUPS flow offline and sync later; admin can see/operate it; rollout path scales to 10 kiosks. | Validates platform core before polish and before fleet expansion. |

---

## 14. Immediate Next Steps

1. Review this planning architecture with JM.
2. Confirm hardware/pilot assumptions.
3. Draft `docs/prd-v2-retail-kiosk-platform.md` using this structure.
4. Convert the PRD into OpenSpec capabilities:
   - `local-runtime`;
   - `campaign-packages`;
   - `fleet-management`;
   - `campaign-scheduling`;
   - `remote-operations`;
   - `restore-recovery`;
   - `admin-dashboard`;
   - `analytics-audit`.
5. Create implementation issues/tasks after PRD approval.

---

## 15. CEO Assessment

The platform should be designed from day one as a reusable operational product. The commercial value is not the spin wheel; the commercial value is the ability to deploy, monitor, recover, and measure branded activations across locations with minimal field support.

The PRD must therefore prioritize the boring operational substrate — identity, local durability, tickets, commands, schedules, recovery — before premium animation polish. The kiosk can be beautiful later. First, it must not lose money, tickets, or trust.
