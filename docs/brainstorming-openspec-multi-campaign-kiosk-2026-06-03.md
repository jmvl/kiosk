# Brainstorming — OpenSpec Multi-Campaign Kiosk Foundation

Date: 2026-06-03
Branch: `foundations`

## Objective

Use an OpenSpec-style structure to turn the Chocomel kiosk idea into clear product/architecture requirements before deeper implementation.

## Created OpenSpec Artifacts

```text
openspec/project.md
openspec/changes/multi-campaign-kiosk-foundation/proposal.md
openspec/changes/multi-campaign-kiosk-foundation/design.md
openspec/changes/multi-campaign-kiosk-foundation/tasks.md
openspec/changes/multi-campaign-kiosk-foundation/specs/campaign-runtime/spec.md
```

## Core Brainstorm Outcome

The platform should be specified as a campaign runtime, not a Chocomel app.

```text
Campaign Manifest + Game Template + Shared Runtime = Branded Kiosk Activation
```

## Highest-Value Next Step

Refactor the kiosk player to load campaign data from `campaigns/chocomel/campaign.json` or from a local backend endpoint like:

```text
GET /api/campaign/current
```

This immediately proves the reusable platform architecture.

## Key Requirements Captured

1. Campaign manifests must drive branded experiences.
2. Backend must remain source of truth for sessions/prizes/printing.
3. Assets must carry rights/usage classification.
4. Runtime must support offline play.
5. Events must be auditable.

## Strategic Decision

The Chocomel campaign should validate the first `spin-wheel` template while avoiding Chocomel-specific logic inside shared runtime code.
