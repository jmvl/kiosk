# Decision: Kiosk Player UI Stack and Campaign Game Runtime

Date: 2026-06-16
Status: accepted

## Context

The kiosk platform has three different frontend surfaces:

1. the fullscreen kiosk player shell;
2. the operator/admin dashboard;
3. campaign/game modules such as a Wheel-of-Fortune activation.

These surfaces do not need the same UI framework. The kiosk player is an appliance UI served locally, not an SEO or SaaS surface. Campaign games should be package-loaded and isolated from platform/hardware access.

## Decision

Use the following split:

| Surface | Stack | Rationale |
|---|---|---|
| Kiosk player shell | Svelte + Vite | Lean static appliance UI, simple reactivity, small runtime, less shell boilerplate. |
| Campaign/game module | PixiJS + GSAP + Howler | GPU-friendly rendering, deterministic premium spin animation, timeline control, sound effects. |
| Admin dashboard | React + Vite for now | Existing implementation; larger dashboard ecosystem remains useful for forms/tables/ops screens. |
| Local/central backend | Fastify + SQLite/PostgreSQL + Drizzle | Existing platform foundation remains valid. |

Campaign code must remain isolated in a sandboxed iframe and communicate through the parent-owned package bridge. The campaign module must not directly access hardware, runtime URLs, secrets, filesystem, printer, token/coin input, or authoritative prize selection.

For Wheel-of-Fortune campaigns the approved model is **hybrid, offline-first backend authority**:

For supermarket/retail brand activations, this is a **promotional high-win engagement mechanic**, not a casino-style gambling mechanic. Most participants may win something by design; the backend authority exists for auditability, inventory/cap control, ticket integrity, and offline continuity, not because the retail campaign is a casino game. Future casino products must be treated as a separate compliance class.

- the campaign manifest defines the prize table, weights, and optional package-level win caps;
- `outcome_strategy.authority` is `local_backend`;
- `outcome_strategy.offline_required` is `true`;
- the local backend performs the weighted draw from its cached campaign package/config without internet access;
- the PixiJS campaign module receives or requests the authoritative outcome and only animates toward that result;
- ticket creation, HMAC/signature, print execution, inventory/cap accounting, and sync queue writes stay backend-owned.

Internet connectivity is optional for play. When offline, the kiosk continues from its locally cached package, local SQLite state, and local outcome rules, then syncs events/results once connectivity returns.

## Wheel-of-Fortune research notes

Reviewed implementation references:

| Reference | Stack | Takeaway |
|---|---|---|
| `zarocknz/javascript-winwheel` | Canvas + GSAP/TweenMax | Mature MIT reference with many prize-wheel features, but old and no longer actively developed. Use as concept/reference only. |
| Konva Wheel of Fortune demo | Konva Canvas 2D | Useful for angular velocity, friction, touch/mouse spin, and wedge detection concepts. |
| `Hafaux/xp-wheel` | PixiJS + GSAP + Howler | Best reference shape for our game module: rendering, timeline animation, and audio. |
| `cirocki/Fortune-Wheel` | React + Recharts + GSAP | Fine for toy/random picker; too chart-like for kiosk-grade game feel. |
| `Ajay-Maury/spin-wheel-game` | React + TypeScript component | Useful prototype reference, not platform/game core. |
| `dr5hn/spin-a-wheel` | Phaser.js | Viable alternative if future campaigns become broader 2D games. |
| `jim60105/UnfairSpinWheel` | Vue + TypeScript | Useful weighted-odds concept; AGPL license means do not reuse code. |

## Asset sourcing rule

Use campaign asset manifests with provenance. Prefer:

- brand-approved assets for production campaigns;
- Game-icons.net and CC0/open repositories for placeholders or properly attributed generic icons;
- generated/crafted campaign art that is explicitly approved and stored with provenance metadata.

Do not import random marketplace assets into production packages unless license and attribution are recorded.

## Consequences

- `apps/kiosk-player` should not depend on React.
- SvelteKit is unnecessary for the player shell; use plain Svelte + Vite to avoid routing/SSR complexity.
- PixiJS should be loaded only inside campaign modules, not the player shell.
- If a campaign result has monetary/inventory/fraud sensitivity, the local backend must be the authority for the outcome and the module only animates toward the backend result.
- Campaign manifests may include `outcome_strategy` with `authority: "local_backend"`, `offline_required: true`, `selection: "weighted_random"`, and a local prize table. Frontend-owned prize selection is intentionally rejected for offline hybrid wheel campaigns.
