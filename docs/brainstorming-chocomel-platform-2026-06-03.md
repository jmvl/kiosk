# Brainstorming — Multi-Campaign Retail Kiosk Platform + Chocomel First App

Date: 2026-06-03
Project: Retail Kiosk Activation Platform
Source project folder: `/home/ubuntu/projects/retail-kiosk-activation`

## Session Intent

JM wants to spin up a new app from the existing retail kiosk activation architecture, work with Git, and keep the foundation reusable for multiple promotional/advertising campaigns.

The first branded app concept is **Chocomel** by FrieslandCampina, using a spinning-wheel promotional game.

## Brand Source Notes

Reference URL: https://www.frieslandcampina.com/brands/chocomel/

Observed brand copy from FrieslandCampina page:

- Brand: Chocomel
- Positioning line: “Experience the one and only chocolate taste sensation”
- Heritage: chocolate flavoured milk since 1932
- Known as: Chocomel — “de Enige Echte” — in the Netherlands and Germany; Cécémel in Belgium
- Taste language: creamy, rich, smooth, chocolatey
- Usage modes: ice cold, on-the-go, or warm with whipped cream
- Core phrase: “One and only”

Observed page imagery/assets:

- Chocomel logo image: `https://www.frieslandcampina.com/uploads/2023/01/Logo_Chocomel-one-and-only_yellow-330x264.png`
- Can/product imagery: `https://www.frieslandcampina.com/uploads/2023/01/GIRL-C2-F1_CAN_1440_0-470x438.webp`
- Lifestyle/serving image: `https://www.frieslandcampina.com/uploads/2023/01/8466-Chocomel-Sfeerbeelden-C-330x330.jpg`
- Bottle/box product image: `https://www.frieslandcampina.com/uploads/2023/01/BOXES-BOTTLE-F2_1120x964-330x330.webp`
- Bike/bottle lifestyle image: `https://www.frieslandcampina.com/uploads/2023/01/SPP-46-Chocomel-BIKE-BOTTLE-005-330x330.webp`

Note: these are public page assets and should be treated as reference material unless rights/usage permissions are confirmed for production.

## Strategic Architecture Direction

The platform should not be one app per campaign with duplicated logic. It should be a **campaign-driven kiosk runtime**:

```text
Shared kiosk platform
  ├── common local backend
  ├── common hardware adapters
  ├── common event/session/ticket model
  ├── common admin dashboard/control plane
  └── campaign packages
       ├── Chocomel spinning wheel
       ├── Future brand activation A
       ├── Future brand activation B
       └── Seasonal supermarket campaign
```

## Recommended System Model

### 1. Shared Runtime

The kiosk device runs a reusable shell:

- browser fullscreen shell
- local backend API/WebSocket
- coin/printer hardware services
- event queue
- campaign loader
- local health/status endpoint

The runtime should know how to:

- start a session after coin insertion
- load campaign config/assets
- run a game flow
- request a print
- log events
- sync events to central backend

It should **not** hardcode Chocomel-specific logic.

### 2. Campaign Package

Each campaign should be represented by a versioned package/config:

```text
campaigns/chocomel/
  campaign.json
  assets/
    logo.png
    wheel-segments/
    backgrounds/
    product-images/
    sounds/
  questions.json
  prizes.json
  ticket-template.json
  theme.json
```

A campaign package controls:

- brand colors
- logo and product images
- attract screen copy
- wheel segment visuals
- prize rules
- questions
- ticket template
- sounds/animations
- legal/disclaimer copy

### 3. Game Template

For Chocomel, the first game template is:

```text
coin inserted → spin wheel → question → prize reveal → print ticket
```

But the platform should support more templates later:

- spin wheel
- scratch card
- memory game
- quiz-only
- barcode scanner activation
- collect-and-win
- instant coupon

The recommended abstraction is:

```text
GameTemplate + CampaignConfig = BrandedCampaignApp
```

## Chocomel Spinning Wheel Concept

### Visual Direction

Core visual style:

- dominant Chocomel yellow
- rich chocolate brown accents
- creamy highlights
- bold product/logo placement
- playful but premium movement
- “one and only” messaging

Possible scene states:

1. **Attract screen**
   - Chocomel logo
   - product packshot/can/bottle
   - animated chocolate waves
   - “Insert coin to spin”

2. **Coin accepted**
   - short unlock animation
   - “Ready for the one and only spin?”

3. **Wheel screen**
   - wheel segments with product/prize icons
   - Chocomel logo center hub
   - animated pointer
   - chocolate/yellow background particles

4. **Question screen**
   - brand trivia or product/taste question
   - large readable buttons for touchscreen

5. **Prize reveal**
   - celebratory animation
   - prize/coupon display
   - ticket print status

6. **Reset/thank-you**
   - “Enjoy the one and only Chocomel”
   - back to attract loop

### Wheel Asset Ideas

Wheel segment assets could include:

- Chocomel can
- Chocomel bottle
- whipped cream cup/hot chocolate reference
- chocolate splash
- coupon icon
- “try again” / consolation segment
- “instant discount” segment
- “free sample” segment
- branded star/badge icon

### Prize Ideas

Candidate prize types:

- discount coupon
- free sample voucher
- buy-one-get-one offer
- branded goodie
- supermarket loyalty points
- “try again” or small consolation message

Prize rules must remain backend-controlled, not frontend-only.

## Git / Repository Direction

Current observation: `/home/ubuntu/projects/retail-kiosk-activation` currently contains documentation files but is **not yet a Git repository**.

Recommended Git structure options:

### Option A — Monorepo Platform

```text
retail-kiosk-activation/
  apps/
    kiosk-player/
    admin-dashboard/
  services/
    local-backend/
    central-api/
    kiosk-agent/
  campaigns/
    chocomel/
  packages/
    game-engine/
    ui-kit/
    campaign-schema/
  docs/
```

Best if Acmea will own the whole platform and run many brand campaigns.

### Option B — Platform Repo + Campaign Repos

```text
retail-kiosk-platform/
chocomel-kiosk-campaign/
future-brand-campaign/
```

Best if campaigns need separate client approvals, separate IP handling, or separate deployments.

### Recommendation

Start with **Option A monorepo** for MVP speed and architectural cohesion.

Later, campaign packages can be exported or split if commercial/client boundaries require it.

## Proposed First Milestone

Create a Git-backed MVP skeleton with:

```text
apps/kiosk-player
services/local-backend
campaigns/chocomel
packages/campaign-schema
docs
```

Initial Chocomel prototype should use simulated hardware:

- fake coin insert button
- fake printer event
- local event log
- wheel animation placeholder
- campaign config loaded from `campaigns/chocomel/campaign.json`

## Open Decisions

1. Confirm whether to initialize Git in `/home/ubuntu/projects/retail-kiosk-activation`.
2. Confirm whether campaign packages should be stored inside the same repo for now.
3. Confirm whether Chocomel assets can be downloaded/used as local reference assets, or only referenced until rights are confirmed.
4. Decide frontend stack: likely Vite + React + PixiJS + GSAP.
5. Decide local backend stack: Node.js/Fastify is the fastest path.
6. Decide if first milestone is pure frontend simulation or frontend + local backend together.

## Recommended Next Action

Initialize the project as a Git monorepo and scaffold:

```text
apps/kiosk-player/
services/local-backend/
campaigns/chocomel/
packages/campaign-schema/
docs/
```

Then create the first campaign manifest for Chocomel and build a simulated player that consumes it.
