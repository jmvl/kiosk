# Retail Kiosk Activation Platform — OpenSpec Project Context

## Mission

Build a reusable, campaign-driven retail kiosk activation platform where each branded promotion is a versioned campaign package running on the same local-first kiosk runtime, hardware-safe backend, and central control plane.

Chocomel is Campaign #1 and should validate the spinning-wheel template without hardcoding brand-specific logic into the platform runtime.

## Business Outcome

Create a reusable Acmea commercial asset:

- launch new retail activations faster
- reuse kiosk hardware/backend/admin/deployment foundations
- reduce per-brand engineering cost
- preserve offline operation in supermarket environments
- produce auditable coin/session/prize/ticket events

## Current Repository State

Branch: `foundations`

Current structure:

```text
apps/kiosk-player/           Vite/React fullscreen player prototype
apps/admin-dashboard/        placeholder
services/local-backend/      Fastify local API and simulated events
services/central-api/        placeholder
services/kiosk-agent/        placeholder
packages/campaign-schema/    TypeScript campaign manifest contract
campaigns/chocomel/          first campaign package
```

## Product Principles

1. Local-first: kiosk must continue operating when internet fails.
2. Hardware-safe: coin/printer interactions are owned by a local backend, not browser JavaScript.
3. Campaign-driven: brands configure content/assets/prizes/questions without forking core runtime.
4. Audit-friendly: every coin, spin, answer, prize, ticket, and remote command is logged.
5. Remote-managed: operators can observe health and recover devices remotely.
6. Rights-aware: public brand assets are prototype references until production approval is secured.

## Technical Defaults

Greenfield target stack:

- Monorepo/language: TypeScript-first `pnpm` workspaces.
- Kiosk player: Vite + React + PixiJS + GSAP.
- Local runtime API: Node.js + Fastify + Zod + SQLite.
- Campaign schema: shared TypeScript/Zod package.
- Central control plane: Fastify TypeScript API + PostgreSQL + Drizzle.
- Admin dashboard: Vite + React first; Next.js only if later requirements justify SSR/routing complexity.
- Realtime: WebSocket/SSE for MVP; MQTT or NATS for production fleet messaging.
- Deployment: Docker Compose, Caddy for auto-SSL central routing, systemd on kiosk hosts.
- Remote access: Tailscale/WireGuard.
- Runtime target: vertical kiosk screen, likely 1080x1920.
- MVP hardware: simulated coin and printer endpoints.
- Production hardware: coin acceptor adapter and ESC/POS printer adapter behind the local runtime API.

## OpenSpec Usage Convention

Use `openspec/changes/<change-id>/` for proposed product/architecture changes.

Each change should include:

- `proposal.md` — why this matters and what changes.
- `design.md` — architectural decisions, trade-offs, and risks.
- `tasks.md` — implementation checklist.
- `specs/<capability>/spec.md` — requirement deltas using MUST/SHOULD language and scenarios.

Use this for meaningful changes before implementation so we can preserve business logic and avoid one-off campaign drift.
