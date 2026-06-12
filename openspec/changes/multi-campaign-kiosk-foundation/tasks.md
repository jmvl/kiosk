# Tasks — Multi-Campaign Kiosk Foundation

## Brainstorm / Spec Tasks

- [x] Capture project context in `openspec/project.md`.
- [x] Draft proposal for multi-campaign kiosk foundation.
- [x] Draft design notes and risks.
- [x] Draft capability requirements for campaign runtime.

## Implementation Tasks

- [ ] Add runtime campaign loader to `apps/kiosk-player`.
- [ ] Stop hardcoding Chocomel campaign data in `apps/kiosk-player/src/main.tsx`.
- [ ] Validate `campaigns/chocomel/campaign.json` against `packages/campaign-schema`.
- [ ] Add local backend endpoint: `GET /api/campaign/current`.
- [ ] Add local backend endpoint: `POST /api/session/start` triggered by coin simulation.
- [ ] Add local backend endpoint: `POST /api/session/:id/spin-result` or equivalent backend-owned prize decision.
- [ ] Add event types for campaign loaded, session started, spin requested, prize selected, question answered, ticket print queued.
- [ ] Add persistence beyond in-memory event log, even if SQLite/local JSON for MVP.
- [ ] Add a second placeholder campaign package to prove multi-campaign loading.

## Verification Tasks

- [ ] `pnpm build` succeeds.
- [ ] Chocomel campaign loads from manifest, not hardcoded UI data.
- [ ] Kiosk player still runs full simulated flow.
- [ ] Backend health endpoint reports current campaign id/version.
- [ ] Event log records coin/session/spin/question/prize/print events.
- [ ] A second test campaign can be selected without changing core UI source code.
