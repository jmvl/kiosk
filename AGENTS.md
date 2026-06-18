# DOX framework — Retail Kiosk Activation

- DOX is installed here as the AGENTS.md hierarchy contract for this repository.
- Agents must follow DOX instructions across any edits.

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees.
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it.
- Retail Kiosk Activation is a pnpm monorepo for kiosk player, admin dashboard, local/central services, kiosk agent, shared contracts, campaign schema, deployment infra, and QA evidence.

## Read Before Editing

1. Read this root AGENTS.md.
2. Identify every file or folder you expect to touch.
3. Walk from the repository root to each target path.
4. Read every AGENTS.md found along each route.
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there.
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules.
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX.

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index.
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index.
- Each parent explains what its direct children cover and what stays owned by the parent.
- The closer a doc is to the work, the more specific and practical it must be.

## Project-Specific Work Guidance

- Treat this as a live kiosk operating-layer monorepo, not a disposable prototype: preserve contracts between player, backend, agent, schemas, and infra.
- Use `pnpm` only; the root package declares `pnpm@9.6.0`, Node `>=22 <23`, and pnpm `>=9 <10`.
- Do not remove infrastructure, services, campaigns, generated artifacts, or deployment scripts without explicit human authorization.
- Keep runtime contract changes centralized in `packages/shared-types` and schema changes in `packages/campaign-schema`; consumers must be updated together.
- Campaign manifests may carry bilingual `fr-BE`/`nl-BE` quiz, outcome, ticket template, bitmap asset, QR payload, and visual wheel mapping config; keep those validation contracts in `packages/campaign-schema`.
- Keep hardware-facing and kiosk-host assumptions explicit in docs/runbooks/infra when changed.
- Do not model token insertion as a universal prerequisite: campaigns may launch by token, schedule, operator action, or autoplay/video/animation mode. Token-required behavior must be campaign-specific.
- Treat supermarket/retail wheel campaigns as promotional high-win brand activations, not casino mechanics; future casino products are a separate compliance class.
- Treat printer/token hardware as kiosk-profile capabilities, not global assumptions. Admin/runtime readiness must distinguish required, optional, and not-installed peripherals; printer paper state must be surfaced when CUPS reports media faults or marked for operator confirmation when unknown.
- Do not treat generated `dist/`, `dist-web/`, `node_modules/`, `.venv-*`, `test-results/`, or `qa-artifacts/` files as source unless the task explicitly asks for evidence or deployable bundles.
- Prefer small, verifiable changes with smoke tests because this project touches physical kiosk behavior.

## Verification

Use the narrowest existing check that covers the change, then broaden for cross-package work:

- Root CI baseline: `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- CI-equivalent script: `pnpm ci` runs install with frozen lockfile plus typecheck/test/build.
- Campaign package validation: `pnpm package:validate` when touching campaign schema, campaign manifests, module assets, or ticket templates.
- Database contract checks: root `db:*` scripts when touching Drizzle schema, migrations, local backend DB, or central API DB.
- Kiosk/player/admin changes: run the affected package tests plus the relevant smoke tests before reporting done.
- Infra/runbook changes: verify commands, paths, units, and kiosk host assumptions against live state where available before making operational claims.

## Dependency Source Reference

- `opensrc` is installed globally for dependency source inspection; use it when package docs/types are not enough.
- For npm dependencies, always pass this project as the version-resolution root: `opensrc path <package> --cwd /home/ubuntu/projects/retail-kiosk-activation`.
- High-value kiosk packages to inspect before non-trivial integration/debugging: `react`, `vite`, `fastify`, `@fastify/websocket`, `drizzle-orm`, and `better-sqlite3`.
- Use cached source as supporting evidence only; local code, lockfiles, and runtime verification remain authoritative.
- Never commit `~/.opensrc/` cache contents into this repository.

## Child Doc Shape

Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards.

Default section order:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational.
- Document stable contracts, not diary entries.
- Put broad rules in parent docs and concrete details in child docs.
- Prefer direct bullets with explicit names.
- Do not duplicate rules across many files unless each scope needs a local version.
- Delete stale notes instead of explaining history.
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist.

## Closeout

1. Re-check changed paths against the DOX chain.
2. Update nearest owning docs and any affected parents or children.
3. Refresh every affected Child DOX Index.
4. Remove stale or contradictory text.
5. Run existing verification when relevant.
6. Report any docs intentionally left unchanged and why.

## User Preferences

- JM prefers Docker/Nginx/LE/systemd where relevant, GitHub Issues, CHANGELOG.md plus semver, and verified live state before operational claims.
- Infra rule: never remove components without explicit human authorization.
- UI/UX rule: aggressively declutter visible labels/helper text so every UI element earns its place.
- Infra/kiosk deploys should keep going until working and should verify as orchestrator.

## Child DOX Index

Top-level scopes currently owned by this root document unless a child AGENTS.md is later added:

- `apps/kiosk-player/` — kiosk-facing player UI and runtime package bridge.
- `apps/admin-dashboard/` — admin/operator dashboard UI.
- `services/local-backend/` — local kiosk backend, SQLite/Drizzle data layer, APIs, sessions, telemetry, hardware/events, tickets, schedules, and runtime CLI.
- `services/central-api/` — central service API and database integration.
- `services/kiosk-agent/` — kiosk agent package and smoke tests.
- `packages/shared-types/` — cross-service event, command, hardware, heartbeat, session, and ticket contracts.
- `packages/campaign-schema/` — campaign manifest schema, validation tooling, and contract tests.
- `campaigns/` — campaign packages, assets, modules, manifests, and ticket templates.
- `infra/` — systemd units, udev rules, tmpfiles, deployment/runtime environment templates.
- `docs/` — product docs, decisions, physical hardware evidence, orchestrator plans, and runbooks.
- `qa-artifacts/` and `test-results/` — task-scoped QA evidence; keep out of durable docs unless intentionally promoted.
- `openspec/` — OpenSpec change-management artifacts.
- `assets/` and `src/` — shared/static project materials when present.
