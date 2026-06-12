# Proposal — Greenfield Platform Foundation

## Status

Brainstorming / OpenSpec proposal draft.

## Why

The current repository already has a useful prototype foundation, but JM clarified that we can step back and define a **greenfield OpenSpec foundation** with the correct technical stack before committing deeper implementation.

This is the right move. A kiosk platform will become expensive to unwind if we choose the wrong boundaries early: frontend-owned prize logic, weak offline persistence, campaign-specific runtime code, or an admin/control plane that cannot support fleet operations.

The strategic asset is not the Chocomel demo. The strategic asset is a reusable Acmea retail activation platform that can run many campaigns with a controlled, auditable, remotely managed kiosk runtime.

## What Changes

Define the target foundation as a greenfield architecture, then align implementation to it.

The platform will be specified as:

```text
Campaign Package
  + Game Template
  + Kiosk Runtime
  + Local Hardware-Safe Backend
  + Central Control Plane
  + Admin Dashboard
  = Reusable Retail Activation Platform
```

## Recommended Greenfield Tech Stack

### Monorepo and Language

- TypeScript-first monorepo.
- `pnpm` workspaces.
- Local-first runtime is mandatory: kiosk sessions/events are persisted locally and synced later when internet returns.
- Optional later: Turborepo/Nx if build orchestration becomes complex; not needed on day one.

### Kiosk Player

- Vite + React + TypeScript.
- PixiJS for game/canvas rendering.
- GSAP for animation choreography.
- Optional Rive only for designer-authored brand animations.
- Runs fullscreen in Firefox/Chromium kiosk mode.

### Local Kiosk Backend

- Node.js + Fastify + TypeScript.
- Zod for runtime validation.
- SQLite for local durable queue/session/event persistence.
- ESC/POS printer adapter behind backend service.
- Coin acceptor adapter behind backend service.
- WebSocket/SSE to kiosk player for state updates.

### Campaign Package Layer

- JSON manifest validated by shared schema package.
- Zod schemas generated or maintained in TypeScript.
- Local asset bundle with usage classification: production, prototype-reference, placeholder.
- Versioned campaign packages.

### Central Control Plane

- Fastify/NestJS-style TypeScript API. Prefer Fastify first for speed and consistency.
- PostgreSQL canonical database.
- Drizzle ORM for schema/type control without Prisma runtime weight.
- WebSocket for MVP realtime command/status.
- MQTT or NATS later for production fleet messaging.

### Admin Dashboard

- React + Vite or Next.js.
- Recommendation: Vite + React first unless SSR/auth routing needs become complex.
- Role-based admin views: viewer, operator, admin, superadmin.

### Deployment and Operations

- Docker Compose for local/dev and central services.
- Caddy for central API/admin auto-SSL and reverse proxy.
- systemd on kiosk host for service lifecycle.
- Tailscale/WireGuard for emergency remote access.
- GitHub Actions for CI.
- Semver + CHANGELOG.md.

## Scope

### In Scope

- Define greenfield architecture and repo boundaries.
- Define correct base stack.
- Define capabilities/spec requirements.
- Define implementation tasks to realign repo with spec.
- Preserve Chocomel only as Campaign #1, not platform logic.

### Out of Scope For This Change

- Production hardware integration.
- Final admin UI design.
- Cloud hosting procurement.
- Brand/legal approval for Chocomel production assets.
- Full production deployment.

## Success Criteria

- OpenSpec artifacts clearly define the target foundation.
- Stack choices are explicit and justified.
- Implementation tasks can move the current repo toward this greenfield target.
- Chocomel remains a campaign package, not a runtime dependency.
- The first code milestone can be validated locally with simulated hardware.

## Strategic Recommendation

Proceed with this greenfield spec as the source of truth, then adjust the existing `foundations` branch implementation to comply.

The first implementation change should be: **runtime loads campaign manifest through backend endpoint and validates it with shared schema**.
