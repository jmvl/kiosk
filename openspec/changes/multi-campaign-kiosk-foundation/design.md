# Design — Multi-Campaign Kiosk Foundation

## Architecture Summary

The platform is split into five layers:

```text
Campaign Package
  ↓
Game Template
  ↓
Kiosk Player UI
  ↓
Local Backend / Runtime Truth
  ↓
Central Control Plane / Admin / Analytics
```

## Key Design Decision

Campaign packages configure the experience. They do not own hardware truth.

The kiosk player may animate a wheel, but it must not be trusted to choose the real prize or issue the real ticket. The local backend remains the source of truth.

## Proposed Runtime Flow

1. Kiosk boots.
2. Local backend starts and exposes health/session/event APIs.
3. Kiosk player loads active campaign manifest.
4. Kiosk enters attract mode.
5. Coin event is recorded by local backend.
6. Backend creates a session and authorizes gameplay.
7. Player animates spin-wheel template.
8. Backend determines/records selected prize according to campaign rules.
9. Player shows question and prize reveal.
10. Backend queues/executes print event.
11. Backend records complete session and syncs when online.

## Campaign Manifest Responsibilities

The manifest should define:

- identity: id, slug, name, brandName
- lifecycle: draft/active/paused/archived
- gameTemplate: currently `spin-wheel`
- copy: attract, CTA, question, prize, reset
- theme: colors, font, layout hints
- assets: logo/product/background/sound references
- wheelSegments: labels, colors, visual assets, prize linkage, weights
- questions: localized questions/options
- prizes: labels, limits, print labels
- legalNotes: rights, disclaimers, campaign conditions

## Backend Responsibilities

The local backend should own:

- session creation
- coin events
- prize selection and enforcement
- duplicate-ticket prevention
- print command execution
- event queue
- offline persistence
- health status

## Frontend Responsibilities

The kiosk player should own:

- attract screen
- touchscreen-friendly interaction
- animation choreography
- rendering campaign copy/assets/theme
- WebSocket/API communication with local backend
- resilient UI state transitions

## Chocomel Design Notes

Chocomel should validate the first `spin-wheel` template.

Recommended creative direction:

- strong yellow and chocolate brown palette
- “one and only” messaging
- product/logo as hero identity
- wheel center hub as brand mark area
- chocolate-wave/creamy motion background
- prize segments including free sample, discount, warm Chocomel, try again

## Risks

| Risk | Impact | Mitigation |
|---|---:|---|
| Chocomel logic leaks into platform runtime | High | Keep campaign-specific content in `campaigns/chocomel` only |
| Frontend controls prize outcome | High | Backend must determine/confirm prize before print |
| Public asset usage becomes production risk | Medium | Mark as prototype-reference; require approved asset bundle |
| Manifest schema too rigid too early | Medium | Start strict for core fields, allow `metadata` later |
| Runtime depends on network | High | Local manifest cache and local event queue |

## Recommended Next Architectural Move

Refactor `apps/kiosk-player` to load campaign data from `campaigns/chocomel/campaign.json` or a served `/api/campaign/current` endpoint instead of keeping a hardcoded object in `main.tsx`.

This is the strongest next step because it validates the platform thesis immediately.
