# Mattermost Conversation Map — Retail Kiosk Project

_Date mapped: 2026-06-07_
_Source session: Mattermost session `20260604_101933_016e66ed`, title `Retail kiosk platform PRD review`._

## 1. Conversation Arc

### Step 1 — New PRD review request

JM asked to read the new PRD documents:

- `docs/prd-v2-retail-kiosk-platform.md`
- `docs/admin-dashboard-prd-brainstorm-v2.md`
- `docs/prd-plan-and-architecture-v2.md`

The review concluded that the project should be treated as a **retail kiosk activation fleet and campaign platform**, not a one-off Chocomel game.

Core platform thesis registered:

```text
Local-first kiosk runtime
+ campaign packages
+ fleet/admin control plane
+ deployment/recovery discipline
= reusable managed activation platform
```

### Step 2 — Architecture direction confirmed

The PRD architecture was mapped as:

```text
Admin Dashboard
→ Central API + PostgreSQL + object storage
→ Kiosk Agent
→ Local Runtime API + SQLite
→ Kiosk Player
→ Hardware HAL: coin + printer
```

Non-negotiable principles:

- local-first operation;
- backend-owned game/ticket truth;
- append-only events;
- unique ticket lifecycle;
- campaign manifests/packages;
- kiosk identity and heartbeat;
- authenticated remote commands with lifecycle;
- Docker Compose/systemd deployment;
- Caddy for central SSL;
- Uptime Kuma as supporting monitoring, not source of product truth;
- no SSH as normal operations.

### Step 3 — Dashboard positioning clarified

The admin dashboard was framed as an **operations cockpit**, not a generic admin panel.

Required dashboard concepts:

- fleet overview;
- kiosk detail;
- command queue;
- deployment center;
- rollback workflow;
- restore/recovery center;
- campaign calendar;
- campaign cache readiness;
- analytics;
- audit log;
- RBAC.

Key product insight:

> Redeploy, rollback, reboot, and restore are workflows, not buttons.

### Step 4 — MVP sequence agreed

The working MVP order was recorded as:

1. Local Runtime API FSM + SQLite.
2. Campaign manifest + Chocomel campaign package.
3. Kiosk Player reading manifest.
4. Simulated coin/printer HAL.
5. Physical hardware spike.
6. Kiosk Agent heartbeat/identity.
7. Central API/PostgreSQL sync.
8. Admin dashboard fleet view.
9. Remote command lifecycle.
10. Campaign scheduling/cache.
11. Rollback/restore workflow.

### Step 5 — JM provided pilot/hardware decisions

JM then provided the pilot assumptions via the `kiosk-os-coin-printer-2026-06-04.md` document and explicit decisions:

| Topic | Decision |
|---|---|
| Pilot target | 10 kiosks |
| OS / hardware baseline | Linux Mint 22.3 with drivers installed |
| Network | Wi-Fi + Ethernet; LTE card to be checked |
| Remote access | Tailscale mandatory |
| Uptime Kuma | Recommended |
| Screenshot/snapshot monitoring | Approved |
| Brand/client viewer | Later, not v1 |

### Step 6 — Hardware baseline registered

#### Kiosk OS

```text
Hostname: yr-N-A
Management IP: 192.168.1.117
SSH user: yr
OS: Linux Mint 22.3 "Zena"
Kernel: 6.14.0-37-generic
App directory: /home/yr/kiosk
Launcher: /home/yr/kiosk/scripts/start-ptit-lion-kiosk.sh
Local URL: http://127.0.0.1:8787
Required groups: dialout, lpadmin
```

#### Coin acceptor

```text
Device: USB serial coin acceptor via CH340 adapter
USB ID: 1a86:7523 QinHeng Electronics CH340 serial converter
Driver: ch341
Runtime device: /dev/ttyUSB0
Stable device: /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0
Expected event: coin detected source=serial_rx:<hex>
```

Implementation implication: v1 HAL should support CH340 serial coin input and prefer the stable `/dev/serial/by-id/...` path over `/dev/ttyUSB0`.

#### Printer

```text
Device: USB thermal printer
Primary CUPS queue: ICOD-PT80KM
Alternate queue: PT80KM
CUPS URI: usb://ICOD/PT80KM?serial=00000000000590bade
USB ID: 0483:7540 STMicroelectronics ICOD_Thermal_Printer
Driver: usblp
Working print path: CUPS image print through ICOD-PT80KM
HTTP print API: http://192.168.1.10:3000 is unavailable
```

Implementation implication: v1 printing should use CUPS queue `ICOD-PT80KM`; the unavailable HTTP print API must not be treated as a v1 dependency.

### Step 7 — PRDs updated for review

JM asked: “update the prd and show me the link i'll review it”.

Updated files:

- `/home/ubuntu/projects/retail-kiosk-activation/docs/prd-v2-retail-kiosk-platform.md`
- `/home/ubuntu/projects/retail-kiosk-activation/docs/prd-plan-and-architecture-v2.md`
- `/home/ubuntu/projects/retail-kiosk-activation/docs/admin-dashboard-prd-brainstorm-v2.md`

Changes added:

- 10-kiosk pilot target;
- Linux Mint 22.3 kiosk OS baseline;
- CH340 USB serial coin acceptor details;
- ICOD/PT80KM CUPS thermal printer path;
- Wi-Fi + Ethernet; LTE card as spike/check;
- Tailscale mandatory;
- Uptime Kuma recommended, not hard dependency;
- screenshot/snapshot monitoring approved;
- brand/client viewer deferred post-v1;
- physical HAL v1 scope: simulated + CH340 serial coin + CUPS printer;
- admin dashboard snapshot evidence requirements.

Review path provided in Mattermost:

```text
/home/ubuntu/projects/retail-kiosk-activation/docs/prd-v2-retail-kiosk-platform.md
```

Note recorded: the repo had no Git remote configured, so no GitHub/remote web URL was available.

## 2. Current Project Artifact Map

### Main planning docs

| Artifact | Role |
|---|---|
| `docs/prd-v2-retail-kiosk-platform.md` | Main strategic PRD for v2 kiosk platform |
| `docs/prd-plan-and-architecture-v2.md` | Technical plan and architecture companion |
| `docs/admin-dashboard-prd-brainstorm-v2.md` | Admin/ops cockpit PRD brainstorm |
| `docs/prd-v1-fleet-campaign-platform.md` | Earlier v1 fleet/campaign platform PRD |
| `docs/platform-foundation.md` | Platform foundation notes |
| `docs/mvp-plan.md` | MVP execution notes |
| `docs/architecture.md` | Architecture notes |
| `docs/data-model.md` | Data model notes |
| `docs/admin-dashboard.md` | Earlier admin dashboard notes |

### OpenSpec workstreams

| Change | Purpose |
|---|---|
| `openspec/changes/greenfield-platform-foundation/` | Greenfield platform foundation specs |
| `openspec/changes/multi-campaign-kiosk-foundation/` | Multi-campaign kiosk runtime/foundation |
| `openspec/changes/fleet-campaign-scheduling-remote-management/` | Fleet management, scheduling, remote ops, restore/recovery |

### Expected product modules

| Module path | Intended responsibility |
|---|---|
| `apps/kiosk-player/` | Fullscreen kiosk campaign player |
| `apps/admin-dashboard/` | Internal operations cockpit/admin dashboard |
| `services/local-backend/` | Local runtime API, FSM, SQLite, hardware bridge |
| `services/kiosk-agent/` | Heartbeat, status, remote command execution, deployment agent |
| `services/central-api/` | Central API/control plane |
| `campaigns/chocomel/` | First campaign package/reference campaign |

## 3. Strategic Decisions Locked In

| Decision | Status |
|---|---|
| Product is a reusable managed kiosk activation platform | Locked direction |
| Local-first kiosk operation | Non-negotiable |
| Browser does not own hardware directly | Non-negotiable |
| Local backend owns session/prize/ticket truth | Non-negotiable |
| Append-only event logging | Required |
| Duplicate ticket prevention | Required |
| 10-kiosk pilot | Confirmed by JM |
| Linux Mint 22.3 baseline | Confirmed by JM |
| CH340 serial coin acceptor | Confirmed first physical adapter |
| ICOD/PT80KM CUPS thermal printer | Confirmed first printer path |
| Wi-Fi + Ethernet | Required |
| LTE | Spike/check item |
| Tailscale | Mandatory for pilot emergency access |
| Uptime Kuma | Recommended supporting monitoring |
| Screenshot/snapshot evidence | Approved for v1 support/deployment evidence |
| Brand/client viewer | Deferred post-v1 |

## 4. Open Risks / Watch Items

| Risk | Why it matters | Mitigation |
|---|---|---|
| Scope creep before reliable simulated loop | Could delay first operational proof | Build local runtime + campaign + fake HAL first |
| Hardware reliability | Coin/printer failures directly damage field operations | Spike CH340 serial and CUPS printer early |
| Duplicate/lost tickets | Business-critical; prize disputes are costly | Backend-owned ticket lifecycle with unique constraints |
| Remote commands as unsafe buttons | Reboot/restore/deploy can create outages/data loss | Command lifecycle, preflight checks, audit, rollback |
| Offline sync complexity | Kiosks must continue without internet | SQLite queue + idempotent sync |
| Screenshot privacy | Support evidence may expose consumer/brand data | Redacted/on-demand snapshots, access control, retention policy |
| No Git remote configured | Limits collaboration/review traceability | Configure GitHub remote when JM approves repo destination |

## 5. Recommended Next Execution Step

Convert the PRD into executable OpenSpec/task slices in this order:

1. Local Runtime API FSM + SQLite event/session/ticket model.
2. Campaign manifest schema + Chocomel campaign package.
3. Kiosk Player manifest loader + simulated paid flow.
4. Fake coin/printer adapters.
5. CH340 serial coin adapter spike.
6. CUPS `ICOD-PT80KM` printer adapter spike.
7. Kiosk Agent heartbeat/identity.
8. Central API registration/event sync.
9. Admin dashboard fleet overview.
10. Remote command lifecycle.

Business rationale: this creates an operationally credible pilot platform before visual polish, which is the correct Acmea posture for a 10-kiosk retail deployment.
