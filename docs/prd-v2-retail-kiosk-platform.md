# PRD v2 — Retail Kiosk Activation Fleet & Campaign Platform

Date: 2026-06-04  
Status: Draft for JM review  
Owner: Acmea Tech / JM  
Related docs:

- `docs/prd-plan-and-architecture-v2.md`
- `docs/admin-dashboard-prd-brainstorm-v2.md`
- `docs/prd-v1-fleet-campaign-platform.md`
- `docs/architecture.md`
- `docs/data-model.md`

---

## 1. Executive Summary

Build a reusable retail kiosk activation platform for branded supermarket and retail campaigns.

The platform starts with a vertical touchscreen kiosk that runs a coin-triggered promotional flow:

```text
attract screen → coin/token insert → spin wheel → quiz/interaction → prize result → thermal ticket → reset
```

But the product is not merely the game screen. The commercially valuable product is a **managed kiosk fleet and campaign platform** that can deploy, monitor, redeploy, recover, schedule, and measure branded campaigns across many retail locations.

The kiosk must keep operating locally when internet connectivity is unavailable. The central platform must give Acmea/operator staff enough visibility and control to avoid routine on-site intervention.

---

## 2. Product Principles

| Principle | PRD interpretation |
|---|---|
| KISS | Use the simplest reliable architecture that satisfies local-first kiosk operation and remote administration. Avoid custom systems when proven tools can cover the job. |
| DRY | Shared campaign runtime and manifest schema. Do not create a new hardcoded app for every brand. Do not duplicate monitoring/deployment logic already provided by existing tooling unless kiosk-specific requirements force it. |
| Local-first | The kiosk can play, decide prizes, print tickets, and log events without internet. |
| Backend-owned state | Browser renders; local runtime owns coin/session/prize/ticket truth. |
| Reuse before build | Use Uptime Kuma, Tailscale/WireGuard, Docker/systemd, PostgreSQL, object storage, and existing notification channels where appropriate. Build custom only where kiosk domain logic is unique. |
| Audit-first | Coins, sessions, prizes, tickets, admin commands, campaign changes, deploys, rollbacks, and restores are append-only logged. |
| Recovery-safe | Restore/rollback must not silently destroy unsynced event/ticket data. |

### KISS/DRY Debate Position

KISS and DRY are good for this PRD if applied at the right level.

**Good KISS:**

- Use Uptime Kuma for simple availability checks instead of building a full monitoring stack on day one.
- Use Docker Compose and systemd instead of Kubernetes for v1.
- Use one campaign manifest schema instead of campaign-specific code branches.
- Use explicit command lifecycle states instead of an overbuilt workflow engine.

**Bad KISS:**

- Treating redeploy as one button without preflight, health checks, and rollback.
- Skipping local persistence because “the cloud has the data”.
- Using SSH/manual scripts as the normal operating model.

**Good DRY:**

- One kiosk runtime, many campaign packages.
- One command lifecycle model reused for restart, test print, deploy, rollback, restore.
- One event ingestion/idempotency model reused across gameplay and admin events.

**Bad DRY:**

- Overgeneralizing all device actions into abstract plugins before we know the hardware.
- Building a generic IoT platform when this is specifically a retail activation kiosk platform.

Conclusion: **KISS for infrastructure, strictness for money/tickets/redeploy, DRY for campaign/runtime contracts.**

---

## 3. Goals and Non-Goals

### 3A. Confirmed Pilot Assumptions

The v1 pilot target is **10 kiosks**.

Known v1 hardware/software baseline:

| Area | Confirmed assumption |
|---|---|
| Pilot size | 10 kiosks |
| Kiosk OS | Linux Mint 22.3 "Zena" |
| Kernel observed | `6.14.0-37-generic` |
| App directory | `/home/yr/kiosk` |
| Kiosk launcher | `/home/yr/kiosk/scripts/start-ptit-lion-kiosk.sh` |
| Local kiosk URL | `http://127.0.0.1:8787` |
| Required Linux groups | `dialout`, `lpadmin` |
| Network | Wi-Fi + Ethernet required; LTE card to be checked/spiked |
| Remote access | Tailscale mandatory for all pilot kiosks |
| Monitoring | Uptime Kuma recommended for managed deployments and central endpoint/push monitoring, not a hard product dependency |
| Screenshot/snapshot support | Approved for v1 support/deployment evidence, with privacy-aware handling |
| Brand/client viewer | Deferred until after v1/internal dashboard stabilizes |

#### Known first physical hardware

| Device | v1 baseline |
|---|---|
| Coin acceptor | USB serial coin acceptor via CH340 adapter |
| Coin USB ID | `1a86:7523 QinHeng Electronics CH340 serial converter` |
| Coin driver | `ch341` |
| Coin runtime device | `/dev/ttyUSB0` |
| Coin stable device path | `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0` |
| Expected coin event | `coin detected source=serial_rx:<hex>` |
| Printer | USB thermal printer via CUPS |
| Primary CUPS queue | `ICOD-PT80KM` |
| Alternate CUPS queue | `PT80KM` |
| Printer USB ID | `0483:7540 STMicroelectronics ICOD_Thermal_Printer` |
| Printer driver | `usblp` |
| Working print path | CUPS image print through `ICOD-PT80KM` |
| Unavailable print path | HTTP print API `http://192.168.1.10:3000` |

Implementation implication: v1 must support simulated hardware adapters plus the first physical adapters above. The coin adapter should prefer the stable `/dev/serial/by-id/...` path over `/dev/ttyUSB0`. The printer adapter should use the CUPS queue `ICOD-PT80KM`; the unavailable HTTP print API must not be treated as a v1 dependency.

### Goals

- Run branded retail activation campaigns reliably on physical kiosks.
- Support local paid/token play without internet.
- Prevent duplicate or lost prize tickets.
- Manage kiosk identity, location, campaign, version, hardware health, and queue state centrally.
- Allow remote administration: restart, test print, upload logs, maintenance mode, redeploy, rollback, restore.
- Support campaign package versioning and scheduled activation.
- Provide campaign and operations analytics.
- Reuse proven monitoring/ops systems where they reduce custom work.

### Non-Goals for v1

- Full campaign design studio.
- Retailer POS integration.
- Complex payment rails beyond coin/token acceptor abstraction.
- Kubernetes/fleet-scale container orchestration.
- ML prize optimization.
- Public consumer mobile app.
- Building a full observability platform from scratch.
- Building a full MDM/RMM platform from scratch unless required after pilot evidence.

---

## 4. Personas

| Persona | Needs |
|---|---|
| Consumer | Clear instructions, responsive game, fair prize flow, printed ticket. |
| Fleet Operator | See unhealthy kiosks, restart services, test printer, enter maintenance, upload logs. |
| Campaign Manager | Create/publish/schedule campaigns, inspect cache readiness, view campaign results. |
| Technical Admin | Register kiosks, manage deployments, rollback versions, configure integrations. |
| Superadmin | Restore snapshots, manage users/roles, approve critical fleet-wide commands. |
| Field Technician | Install kiosk, validate hardware, replace paper, confirm location/GPS, run diagnostics. |
| Brand Viewer | View approved campaign performance and uptime summaries. |

---

## 5. High-Level Architecture

```text
                         ┌──────────────────────────────┐
                         │  Admin Dashboard              │
                         │  fleet · deploy · campaigns   │
                         │  analytics · audit · recovery │
                         └───────────────┬──────────────┘
                                         │
                                         ▼
                         ┌──────────────────────────────┐
                         │  Central API                  │
                         │  PostgreSQL · auth · events   │
                         │  schedules · commands         │
                         └───────────────┬──────────────┘
                                         │
       heartbeat / event sync / commands / release metadata / campaign packages
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                           Kiosk Device                            │
│                                                                  │
│  ┌──────────────────────┐      local WS/HTTP ┌─────────────────┐ │
│  │ Kiosk Player          │◄─────────────────►│ Local Runtime API│ │
│  │ React/Vite + PixiJS   │                   │ FSM + SQLite     │ │
│  │ fullscreen browser    │                   │ tickets/events   │ │
│  └──────────────────────┘                   └────────┬────────┘ │
│                                                       │          │
│                                              ┌────────▼────────┐ │
│                                              │ Hardware HAL     │ │
│                                              │ coin · printer   │ │
│                                              └─────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Kiosk Agent                                                 │  │
│  │ identity · heartbeat · remote commands · logs · deploy      │  │
│  │ rollback · restore · systemd/Docker integration             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Linux mini-PC · Docker Compose/systemd · Tailscale/WireGuard    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Reuse Existing Systems Where Possible

The PRD should explicitly avoid reinventing commodity infrastructure.

| Need | Reuse candidate | Use in v1 | Build custom? | Notes |
|---|---|---:|---:|---|
| Basic uptime/endpoint monitoring | Uptime Kuma | Yes | No for simple checks | Uptime Kuma supports HTTP(s), TCP, ping, Docker container, push monitors, status pages, and many notification services. Use for external/simple health alerts. |
| Secure remote emergency access | Tailscale or WireGuard | Yes | No | Dashboard should not depend on SSH, but emergency access is valuable. |
| Service supervision | systemd | Yes | No | Kiosk agent, runtime, browser/player should be supervised. |
| Local app packaging | Docker Compose | Yes | Avoid Kubernetes v1 | Matches Acmea preference and keeps deployment simple. |
| Reverse proxy/SSL central services | Caddy | Yes | No | Use Caddy for central dashboard/API SSL if self-hosted. |
| Canonical data store | PostgreSQL | Yes | No | Central source of truth. |
| Asset/log storage | S3-compatible object storage | Yes | No | Campaign bundles and log bundles. |
| Notifications | Existing channels: Telegram/Discord/email/webhooks | Yes | No | Route operational alerts to existing channels. |
| Metrics dashboard | Uptime Kuma first; later Grafana/Prometheus if needed | Maybe later | Avoid for MVP unless needed | Do not start with full metrics stack unless pilot proves need. |
| Remote device management | Evaluate Mender/balena/Portainer/Watchtower-like options | Spike only | Maybe | Deployment requirements are kiosk-specific. Use if they fit rollback/audit/offline constraints. |

### Monitoring Split

Use a two-layer monitoring model:

1. **Commodity external monitoring:** Uptime Kuma checks central API, dashboard, kiosk heartbeat endpoint if reachable, and optional push monitors from kiosks.
2. **Domain-specific kiosk telemetry:** Central API stores kiosk heartbeats, campaign state, printer/coin health, queue length, active session state, command status, and deployment status.

This keeps monitoring simple while preserving kiosk-specific truth.

---

## 7. Consumer Kiosk Experience Requirements

### FR-KIOSK-001: Attract and instruction screen

- Shows current campaign branding, prize offer, and instructions.
- Explains coin/token requirement.
- Uses local cached campaign package.

### FR-KIOSK-002: Coin/token acceptance

- Local Runtime API controls coin acceptor lifecycle.
- Coin events are logged locally.
- Game unlock occurs only when required credit/token condition is met.

### FR-KIOSK-003: Prize/game flow

- Local backend determines prize/result according to campaign rules.
- Frontend animates result but does not decide prize.
- Session cannot be replayed to print duplicate ticket.

### FR-KIOSK-004: Ticket printing

- Ticket record is created before print attempt.
- Ticket code is unique and durable.
- Print lifecycle is tracked: `created → print_requested → printed / failed / reprint_authorized`.
- Test tickets are visibly labeled as test tickets.

### FR-KIOSK-005: Error and maintenance modes

- Kiosk can enter maintenance mode from dashboard or local service state.
- Maintenance mode prevents new paid sessions.
- Error screens must be consumer-safe and operator-actionable.

---

## 8. Local Runtime Requirements

The Local Runtime API is the kiosk source of truth during operation.

Must provide:

- explicit finite-state machine;
- SQLite local storage;
- session table;
- event queue table;
- ticket table;
- campaign cache table;
- local schedule table;
- WebSocket updates for player;
- `/health` and `/status` endpoints;
- sync worker with idempotent upload;
- hardware adapter interface.

Required local health fields:

- runtime status;
- active campaign/version;
- current state;
- queue length;
- last sync attempt/result;
- printer status;
- coin acceptor status;
- current app versions;
- disk space warning;
- local clock/timezone.

### v1 physical hardware adapter scope

The v1 Hardware HAL must include four adapter modes:

| Adapter | Required for v1 | Notes |
|---|---:|---|
| Simulated coin acceptor | Yes | Used for automated tests, demos, and development without hardware. |
| CH340 serial coin acceptor | Yes | Reads from stable serial path `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`; fallback `/dev/ttyUSB0` only for diagnostics. |
| Simulated printer | Yes | Used for automated tests and ticket lifecycle validation. |
| CUPS thermal printer | Yes | Prints through queue `ICOD-PT80KM`; test tickets must be visibly marked. |

Operational diagnostics for the pilot hardware should include:

```bash
fuser -v /dev/ttyUSB0
tail -f /home/yr/kiosk/ptit-lion-server.log
lpstat -p ICOD-PT80KM
lpstat -o
```

---

## 9. Campaign Package & Scheduling Requirements

Campaign packages are versioned and immutable after publication.

### Campaign package includes

- manifest version;
- campaign ID/version;
- brand name;
- visual theme;
- assets;
- wheel segments;
- prize rules;
- quiz/questions;
- ticket template;
- legal copy;
- fallback rules;
- checksum.

### Scheduling

Schedules target:

- one kiosk;
- a location;
- a group/region;
- whole fleet.

Schedule fields:

- campaign version;
- target type/id;
- start/end datetime;
- timezone;
- priority;
- fallback campaign;
- cache required before start;
- status.

Offline rule:

> If a scheduled campaign is already cached and valid, the kiosk switches at the scheduled local time even if internet is unavailable.

---

## 10. Admin Dashboard & Fleet Operations Requirements

The admin dashboard is a first-class module of the kiosk platform, not a separate optional product.

### Dashboard top-level navigation

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

### FR-ADMIN-001: Operations overview

Must show:

- kiosk count by status;
- top devices needing attention;
- active campaigns;
- deployments in progress;
- print failures today;
- command failures;
- total unsynced events;
- version drift across fleet;
- alerts from Uptime Kuma or monitoring integration where useful.

### FR-ADMIN-002: Fleet view

Must show each kiosk with:

- status;
- kiosk name and serial;
- location/group;
- active campaign;
- next campaign;
- player/runtime/agent versions;
- last seen;
- queue length;
- printer status;
- coin acceptor status;
- GPS/geofence state if available;
- current runtime state;
- available actions.

### FR-ADMIN-003: Kiosk detail

Must show:

- identity and assigned location;
- last heartbeat;
- service health;
- current campaign and schedule;
- hardware status;
- local queue length;
- recent sessions/events/errors;
- command history;
- deployment history;
- log bundle links;
- action panel.

### FR-ADMIN-004: Remote command lifecycle

Commands must use lifecycle:

```text
pending → sent → acknowledged → running → succeeded
                                      ↘ failed
pending/sent/running → expired/cancelled
```

Required commands:

- restart player/browser;
- restart local runtime;
- restart kiosk agent;
- reboot kiosk;
- test print;
- upload logs;
- enter maintenance mode;
- resume normal mode;
- refresh campaign cache;
- deploy version;
- rollback version;
- restore snapshot.

Every command must include:

- command ID;
- target;
- requested by;
- role;
- reason;
- expiry;
- idempotency key;
- status timestamps;
- result summary;
- audit record.

### FR-ADMIN-005: Deployment center

Redeploy must be a workflow, not a button.

Workflow:

```text
Draft release
→ Validate artifact/checksum
→ Select target/cohort
→ Run preflight checks
→ Deploy canary or single kiosk
→ Run health checks
→ Expand rollout or pause
→ Complete or rollback
```

Preflight checks:

- kiosk online or queued deployment allowed;
- sufficient disk;
- agent supports deploy command;
- previous known-good version exists;
- no active paid session or deployment scheduled for idle/maintenance window;
- local queue preservation status known;
- campaign compatibility valid.

Post-deploy health checks:

- agent heartbeat reports target version;
- runtime `/health` returns ok;
- player loads attract screen;
- active campaign cache validates;
- printer status available;
- no critical error after configured observation window.

### FR-ADMIN-006: Rollback

- Rollback target must be visible before deploy.
- Rollback preserves local events/tickets.
- Rollback result is health-checked and audited.
- Failed deploy offers rollback path automatically.

### FR-ADMIN-007: Restore snapshot

Restore is high-risk and superadmin-only by default.

Rules:

- v1 restore is non-destructive by default;
- unsynced events/tickets/command logs must be preserved or exported first;
- destructive factory reset is out of v1 unless JM explicitly approves later;
- restore must generate local and central audit records.

### FR-ADMIN-008: Monitoring integration

The dashboard should consume or link to external monitoring where it is useful, without duplicating commodity checks.

v1 monitoring approach:

- Uptime Kuma monitors central API/dashboard endpoints.
- Uptime Kuma can receive push heartbeats from kiosk agent if network model allows.
- Central API remains the source of truth for kiosk-specific telemetry and command status.
- Dashboard may show high-level uptime alerts but does not need to rebuild Uptime Kuma’s status page functionality.

### FR-ADMIN-009: Screenshot/snapshot support

Screenshot/snapshot monitoring is approved for v1 support workflows.

Requirements:

- support on-demand snapshot capture from kiosk detail;
- support optional periodic snapshots if enabled per kiosk/group;
- attach snapshot evidence to deployment health checks and support incidents where useful;
- record snapshot metadata: kiosk ID, timestamp, active campaign, player/runtime/agent version, and command/deployment ID when applicable;
- protect privacy by avoiding unnecessary consumer-identifiable content and by allowing snapshot capture to be disabled if a client/location requires it;
- snapshots are support evidence, not the canonical source of operational truth.

---

## 11. Analytics and Audit Requirements

Analytics must support:

- plays by kiosk/location/campaign/day;
- coins/tokens inserted;
- sessions completed;
- prize distribution;
- ticket print success/failure;
- queue length and offline periods;
- campaign cache readiness;
- deployment success/failure;
- command success/failure.

Audit must capture:

- admin login/security events;
- kiosk registration/location changes;
- campaign changes;
- schedule changes;
- command requests/results;
- deployments/rollbacks/restores;
- ticket anomalies;
- sync failures.

---

## 12. Security and RBAC

Roles:

| Role | Permissions |
|---|---|
| Viewer | View fleet and analytics only. |
| Operator | Restart services, test print, maintenance mode, upload logs. |
| Campaign Manager | Manage campaigns and schedules. |
| Admin | Register kiosks, deploy/rollback, manage locations/groups. |
| Superadmin | Restore snapshots, dangerous fleet-wide commands, user/role management. |

Security requirements:

- Local kiosk services bind to localhost unless explicitly required.
- Remote commands are authenticated, scoped, expiring, idempotent, and audited.
- Dangerous commands require typed confirmation and reason.
- Fleet-wide dangerous commands require elevated permission.
- Device secrets are not shown in UI.
- Emergency SSH/VPN exists but is not the normal workflow.

---

## 13. Data Model Summary

### Central tables

- `locations`
- `kiosks`
- `kiosk_heartbeats`
- `campaigns`
- `campaign_versions`
- `campaign_assets`
- `campaign_assignments`
- `campaign_cache_status`
- `sessions`
- `tickets`
- `events`
- `device_commands`
- `releases`
- `deployments`
- `deployment_targets`
- `health_checks`
- `restore_snapshots`
- `log_bundles`
- `admins`
- `roles`

### Local SQLite tables

- `local_sessions`
- `local_events`
- `local_tickets`
- `campaign_cache`
- `local_schedule_cache`
- `command_log`
- `hardware_status`
- `agent_config`

---

## 14. MVP Roadmap

### MVP 1: Local runtime and simulated kiosk

- Local Runtime API FSM.
- SQLite sessions/events/tickets.
- Campaign manifest schema.
- Chocomel campaign package.
- Kiosk Player reads campaign manifest.
- Simulated coin and printer.
- Runtime `/health` and `/status`.

### MVP 2: Fleet identity and admin operations

- Kiosk registry.
- Kiosk agent heartbeat.
- Fleet overview.
- Kiosk detail.
- Test print command.
- Restart player/runtime.
- Maintenance/resume.
- Upload logs.
- Basic audit log.
- Uptime Kuma for central endpoint monitoring and optional push checks.

### MVP 3: Redeploy and rollback

- Release model.
- Single-kiosk redeploy.
- Preflight checks.
- Post-deploy health checks.
- Previous known-good rollback.
- Deployment audit trail.

### MVP 4: Campaign scheduling and cache readiness

- Campaign assignments.
- Calendar schedule.
- Campaign cache status.
- Local scheduled switch.
- Fallback campaign.
- Cache readiness dashboard.

### MVP 5: Recovery and scale

- Restore snapshot simulation.
- Batch/canary deployment.
- Incident notes.
- Screenshot/snapshot monitoring.
- Brand analytics viewer remains post-v1/P2 unless JM explicitly accelerates it.

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Reinventing monitoring | Wasted time | Use Uptime Kuma for endpoint/push monitoring; build only kiosk-specific telemetry. |
| Treating SSH as normal ops | Not scalable | Dashboard commands and agent workflows must be normal path. |
| Overbuilding IoT platform | Slow delivery | Keep v1 focused on kiosk activation requirements. |
| Underbuilding deploy safety | Bricked kiosks | Preflight, canary, health checks, rollback target required. |
| Internet outage | Lost revenue/data | Local-first runtime with durable SQLite and sync. |
| Duplicate tickets | Financial/client trust damage | Unique durable ticket lifecycle. |
| Printer failure | Bad consumer experience | Test print, health status, failure flow, maintenance mode. |
| GPS weak indoors | False alarms | GPS telemetry only, not gameplay dependency. |
| Campaign not cached before schedule | Wrong campaign active | Cache readiness dashboard and fallback campaign. |
| Restore destroys data | Audit/data loss | Non-destructive restore policy in v1. |

---

## 16. Open Questions for JM

1. **Monitoring reuse:** Uptime Kuma is recommended for managed deployments and central endpoint/push monitoring, not a hard product dependency.
2. **Deployment tooling:** Do we want to evaluate existing tools such as Mender, balena, Portainer, Watchtower-style updaters, or keep v1 deployment custom through the kiosk agent + Docker Compose?
3. **Kiosk OS baseline:** Ubuntu/Debian mini-PC with Docker Compose and systemd, or a more locked-down appliance OS?
4. **Network assumption:** Wi-Fi + Ethernet are required; LTE card support remains a spike/check item.
5. **VPN assumption:** Tailscale is mandatory for all pilot kiosks.
6. **Physical hardware:** v1 first adapters are CH340 USB serial coin acceptor and ICOD/PT80KM CUPS thermal printer.
7. **Redeploy timing:** Should redeploy default to “when idle” rather than “immediately”?
8. **Rollback granularity:** v1 rollback entire release bundle, or separate player/runtime/agent rollback?
9. **Restore policy:** Confirm destructive factory reset is explicitly out of v1.
10. **Brand viewer:** Deferred until after v1/internal dashboard stabilizes.
11. **Screenshots:** Approved for v1 support and deployment evidence.
12. **Commercial metric:** MVP/pilot target is 10 kiosks.

---

## 17. PRD Completeness Checklist

The PRD is ready for implementation planning when it clearly answers:

- What happens when a coin/token is inserted?
- Who decides prize outcome?
- What prevents duplicate tickets?
- What happens when printing fails?
- What works offline?
- What syncs when internet returns?
- How does a kiosk identify itself?
- How is a campaign package validated and activated?
- How does admin redeploy one kiosk?
- How does rollback work?
- How is restore different from rollback?
- What monitoring is delegated to Uptime Kuma or other existing tools?
- What remains custom because it is kiosk-specific?
- What is v1 and what is not v1?

---

## 18. CEO Assessment

The right product is not a custom monitoring system, not a generic IoT platform, and not only a pretty game. The right product is a focused retail kiosk activation platform that reuses commodity operations tools where possible and builds custom logic only where the kiosk business domain requires it: local paid sessions, campaign scheduling, ticket integrity, hardware state, redeploy safety, and auditable fleet control.

KISS and DRY should guide the PRD, but not weaken operational discipline. Keep infrastructure simple. Keep business-critical flows strict.
