# Brainstorming — Greenfield OpenSpec Foundation

Date: 2026-06-03
Branch: `foundations`

## JM Direction

JM clarified that we can start from a greenfield OpenSpec foundation with the correct tech stack, rather than being constrained by the first scaffold.

## Strategic Conclusion

This is the correct approach. The project should not optimize for the first Chocomel screen. It should optimize for a reusable retail activation platform.

## Greenfield Foundation Created

```text
openspec/changes/greenfield-platform-foundation/
  proposal.md
  design.md
  tasks.md
  specs/
    tech-stack/spec.md
    local-runtime/spec.md
    campaign-packages/spec.md
    remote-operations/spec.md
```

## Recommended Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| Language | TypeScript |
| Kiosk UI | Vite + React |
| Game rendering | PixiJS |
| Animation | GSAP |
| Runtime validation | Zod |
| Local backend/runtime | Fastify |
| Local persistence | SQLite |
| Central database | PostgreSQL |
| ORM | Drizzle |
| Admin dashboard | Vite + React first; Next.js only if needed |
| Realtime MVP | WebSocket/SSE |
| Realtime production | MQTT or NATS |
| Deployment | Docker Compose + Caddy |
| Kiosk services | systemd + Docker |
| Remote access | Tailscale/WireGuard |

## Non-Negotiables

- No frontend-only prize logic.
- No browser direct printer control.
- No campaign-specific code in shared runtime.
- No production use of unapproved brand assets.
- No dependency on live internet for paid play sessions.
- Every meaningful event must be auditable.

## Highest-ROI Next Implementation

1. Add Zod schema to `packages/campaign-schema`.
2. Serve active campaign through local runtime API.
3. Refactor kiosk player to load campaign dynamically.
4. Add backend-owned session/prize/print state machine.
5. Persist events in SQLite.
6. Add a second sample campaign to prove reuse.
