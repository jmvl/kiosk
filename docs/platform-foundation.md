# Campaign-Driven Platform Foundation

## Principle

The platform should support many retail activation campaigns without duplicating hardware, backend, admin, deployment, and audit logic.

```text
shared runtime + game template + campaign manifest = branded kiosk activation
```

## Current Foundation Structure

```text
apps/kiosk-player/           Browser fullscreen player
apps/admin-dashboard/        Future fleet/campaign admin UI
services/local-backend/      Local hardware-safe API and event queue
services/central-api/        Future canonical backend/control plane
services/kiosk-agent/        Future remote ops, heartbeat, deploy/rollback agent
packages/campaign-schema/    Campaign manifest contracts
packages/game-engine/        Future reusable game templates
packages/ui-kit/             Future shared kiosk/admin UI components
campaigns/chocomel/          First campaign package
```

## Why This Matters

Chocomel should be Campaign #1, not a one-off app. The commercial asset is the reusable platform:

- faster new campaign launches
- consistent event/audit model
- reusable admin operations
- controlled hardware integration
- brand-specific packaging without runtime duplication

## MVP Boundary

The first milestone should remain simulated:

- fake coin insertion
- fake printer event
- browser wheel prototype
- local backend event log
- Chocomel campaign manifest

Real hardware integration follows after the flow and visual direction are validated.
