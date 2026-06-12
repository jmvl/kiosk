# Design — Greenfield Platform Foundation

## Executive Summary

The retail kiosk activation platform should be built as a local-first, campaign-driven, remotely managed system.

The wrong architecture is a branded React app that pretends to be a kiosk. The right architecture is a controlled runtime where the browser handles presentation and a local backend owns money/session/prize/printing truth.

## Target Repository Shape

```text
retail-kiosk-activation/
  apps/
    kiosk-player/              # fullscreen retail kiosk UI
    admin-dashboard/           # fleet/campaign/admin operations UI

  services/
    local-runtime-api/          # local kiosk backend: session/hardware/events
    central-api/                # canonical API/control plane
    kiosk-agent/                # heartbeat, remote ops, deploy/rollback

  packages/
    campaign-schema/           # Zod + TypeScript manifest schema
    game-templates/            # spin-wheel, scratch-card, quiz-only, etc.
    event-contracts/           # shared event and command types
    ui-kit/                    # shared admin/kiosk components where useful

  campaigns/
    chocomel/                  # campaign package #1
      campaign.json
      assets/
      ticket-template.json

  infra/
    docker/
    caddy/
    systemd/

  openspec/
  docs/
```

## Layer Responsibilities

### 1. Campaign Package

Owns brand-specific configuration:

- copy
- theme
- assets
- wheel segments
- questions
- prizes
- ticket template
- legal notes
- campaign metadata

Must not contain hardware or deployment logic.

### 2. Game Templates

Own reusable interaction patterns:

- spin-wheel
- scratch-card
- quiz-only
- instant-coupon
- memory-game

Game templates receive manifest data and runtime state, then render an experience.

### 3. Kiosk Player

Owns presentation:

- attract screen
- fullscreen UI
- animation
- user input
- local backend communication
- degraded/offline user messaging

It must not decide real prizes or print tickets directly.

### 4. Local Runtime API

Owns local truth:

- active campaign cache
- session state machine
- coin events
- prize selection/enforcement
- print requests/results
- duplicate-ticket prevention
- local durable event queue
- offline buffering with sync status/retry metadata
- idempotent push to central API when connectivity returns
- health endpoint
- WebSocket/SSE state stream

### 5. Kiosk Agent

Owns machine/fleet operations:

- heartbeat
- durable kiosk identity: serial number, name, assigned location
- GPS telemetry when hardware is available
- service health
- system metrics
- local queue length
- campaign cache status
- restore snapshot status
- log upload
- remote restart/reboot/deploy/rollback/restore commands
- maintenance mode

### 6. Central API

Owns canonical backend:

- kiosk registration
- durable kiosk identity, serial numbers, names, locations, and GPS/geofence metadata
- campaign assignment and calendar scheduling
- campaign cache readiness tracking
- event ingestion
- command scheduling
- restore snapshot metadata and restore command lifecycle
- deployment metadata
- auth/roles
- admin dashboard API

### 7. Admin Dashboard

Owns operator workflows:

- fleet overview for 10 to 100+ kiosks
- kiosk detail with serial/name/location/GPS
- campaign calendar and scheduling
- campaign manager
- analytics
- remote operations center
- deployment center
- restore snapshot panel
- audit log
- user/role management

## Recommended Stack Decisions

| Area | Choice | Reason |
|---|---|---|
| Monorepo | pnpm workspaces | Lightweight, proven, enough for MVP |
| Language | TypeScript | Shared contracts across UI/backend/admin |
| Kiosk UI | Vite + React | Fast build, kiosk-friendly, no SSR need |
| Game rendering | PixiJS | Strong 2D/WebGL canvas runtime |
| Animation | GSAP | Timelines, reliable choreographed motion |
| Local backend | Fastify | Fast, simple, Node ecosystem hardware integrations |
| Validation | Zod | Runtime validation for manifests/events/API payloads |
| Local persistence | SQLite | Durable local queue without server dependency |
| Central DB | PostgreSQL | Canonical, reliable, analytics-friendly |
| ORM | Drizzle | Typed schema, low runtime overhead |
| Realtime MVP | WebSocket/SSE | Simple and enough for early fleet status |
| Realtime production | MQTT or NATS | Better fleet command/status scaling |
| Proxy/SSL | Caddy | JM preference, automatic SSL |
| Kiosk ops | systemd + Docker | Reliable boot/restart, deployable units |
| Remote access | Tailscale/WireGuard | No inbound public supermarket ports |

## Critical Boundary Decisions

### Decision 1: Campaign manifests are data, not executable plugins

Start with pure JSON manifests validated by Zod. Avoid executable campaign modules until there is a real need. This reduces attack surface and keeps admin-generated campaigns possible.

### Decision 2: Backend owns prize decision

The frontend may animate a likely result only after backend authorization. The print event must only happen from backend-confirmed session state.

### Decision 3: Offline is first-class

The local runtime must cache active campaign config and queue events. Central API outage must not block supermarket play.

### Decision 4: Public brand assets are never production by default

Any asset scraped or referenced from a public webpage must be marked `prototype-reference`. Production campaigns require approved delivered assets.

## MVP Build Sequence

1. Define shared Zod campaign schema.
2. Validate Chocomel manifest against schema.
3. Serve active campaign from local runtime API.
4. Refactor kiosk player to load campaign from API.
5. Create local session state machine with simulated coin/spin/print.
6. Persist local events in SQLite with sync status/retry metadata.
7. Add offline sync worker with idempotent central API push.
8. Add kiosk identity model: serial number, name, location, versions.
9. Add kiosk heartbeat with GPS telemetry and local queue length.
10. Add remote command lifecycle for restart/reboot/test-print/maintenance.
11. Add campaign assignment and calendar scheduling with local campaign cache.
12. Add restore snapshot command/spec with unsynced data preservation.
13. Add second test campaign to prove runtime reuse.
14. Add Docker Compose for local dev.
15. Add Caddy config placeholder for central services.
16. Add GitHub Actions for install/build/typecheck.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Overbuilding central platform too early | Medium | Keep central API minimal until local runtime is solid |
| Campaign schema too rigid | Medium | Keep core required fields; allow typed metadata later |
| Kiosk player becomes brand-specific | High | Add second test campaign early |
| Hardware integration delays demo | Medium | Keep simulated adapters as first-class dev mode |
| Network dependency blocks supermarket use | High | Require local campaign cache and SQLite queue |
| Asset rights create launch risk | High | Separate prototype references from approved production assets |

## Architectural Non-Negotiables

- No frontend-only prize logic.
- No browser direct printer control.
- No campaign-specific code in shared runtime.
- No production use of unapproved brand assets.
- No dependency on live internet for a paid play session.
- Every meaningful event must be auditable.
