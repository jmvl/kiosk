# Proposal — Multi-Campaign Kiosk Foundation

## Status

Brainstorming / proposal draft.

## Why

The first campaign is Chocomel, but the strategic value is not a single branded spinning-wheel app. The higher-value asset is a reusable kiosk platform that can run multiple campaigns with the same architecture.

If we hardcode Chocomel into the runtime, Acmea gets one demo. If we separate platform runtime, game templates, and campaign packages, Acmea gets a repeatable product line.

## What Changes

Introduce a formal campaign-driven architecture:

```text
shared kiosk runtime + game template + campaign manifest = branded campaign app
```

The platform should support:

- a shared kiosk player shell
- a local hardware-safe backend
- campaign manifests for brand copy, assets, questions, wheel segments, prizes, and ticket templates
- game templates, starting with `spin-wheel`
- Chocomel as the first campaign package
- future campaigns without core runtime duplication

## Scope

### In Scope

- Define campaign runtime requirements.
- Define campaign manifest requirements.
- Define Chocomel first-app constraints.
- Define simulated MVP flow.
- Define separation between frontend animation and backend source of truth.

### Out of Scope For This Change

- Real coin acceptor integration.
- Real ESC/POS printer integration.
- Central admin dashboard implementation.
- Production asset licensing/approval.
- Full deployment/rollback automation.

## Success Criteria

- Chocomel campaign can run from a manifest/config instead of hardcoded platform logic.
- The same kiosk player can theoretically load a second campaign package.
- The local backend remains source of truth for session, prize, and print events.
- Prototype still works with simulated coin/print events.
- Requirements are clear enough to drive implementation tasks.

## Open Questions

1. Should campaign manifests be pure JSON, or should we allow executable campaign modules later?
2. Should asset bundles be local-only, remotely synced, or both?
3. Should prize selection happen completely in the local backend, or should the central API pre-allocate prize inventory when online?
4. Do campaigns need multi-language support from day one?
5. How strict should the first manifest schema be before we build the admin campaign manager?
