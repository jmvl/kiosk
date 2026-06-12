# Decision D1: Drizzle vs Kysely for SQLite/PostgreSQL

Status: recommended / ready for implementer handoff
Date: 2026-06-12
Task: t_be7e4243

## Recommendation

Use Drizzle ORM + drizzle-kit for v1 local SQLite and central PostgreSQL schema/migrations.

Keep the implementation SQL-aware and conservative:

- use separate Drizzle schema modules for SQLite local runtime and PostgreSQL central API;
- generate SQL migrations with drizzle-kit, commit generated SQL, and review it before apply;
- use small service-owned migration runners instead of running migrations implicitly on service boot;
- allow explicit `sql``...`` fragments for PRAGMAs, PostgreSQL-specific constraints, indexes, and one-off data fixes.

Do not choose Kysely for v1 unless the team explicitly wants hand-written SQL/schema migrations over schema-as-code generation. Kysely is a strong query builder, but for this kiosk project it shifts more schema/type/migration bookkeeping onto agents and implementers.

## Why this fits the kiosk PRD

The PRD requires:

- local Node/TypeScript + Fastify + SQLite runtime (`docs/kiosk-operating-layer-prd.md` lines 20-27, 257-266);
- central Fastify/Nest-style API + PostgreSQL (`docs/kiosk-operating-layer-prd.md` lines 351-364);
- durable SQLite policy: WAL, foreign keys, transactions, busy timeout, checkpointing, destructive migration backup/export (`docs/kiosk-operating-layer-prd.md` lines 1048-1058);
- roll-forward migration policy with explicit rollback boundaries (`docs/kiosk-operating-layer-prd.md` lines 1079-1109);
- root commands for local/central migrations (`docs/kiosk-operating-layer-prd.md` lines 1241-1269).

Existing project specs already lean Drizzle:

- `openspec/project.md` lines 50-52: local runtime SQLite; central PostgreSQL + Drizzle.
- `openspec/changes/greenfield-platform-foundation/design.md` lines 159-161: Drizzle selected for typed schema and low runtime overhead.
- `openspec/changes/greenfield-platform-foundation/proposal.md` lines 66-68: Drizzle preferred over Prisma runtime weight.

D1 should therefore lock Drizzle, not reopen the platform architecture, unless Kysely has a decisive advantage. I did not find one for this repo's stated priorities.

## Evidence reviewed

Primary/project sources:

- PRD: `/home/ubuntu/projects/retail-kiosk-activation/docs/kiosk-operating-layer-prd.md`.
- Orchestrator plan: `/home/ubuntu/projects/retail-kiosk-activation/docs/kiosk-orchestrator-plan.md` lines 131-137 define D1 acceptance.
- OpenSpec project/design/proposal references listed above.
- Root `package.json` currently requires Node `>=20` and pnpm 9.6.0.

External sources:

- Drizzle overview: https://orm.drizzle.team/docs/overview — positions Drizzle as lightweight, performant, type-safe, SQL-like, and a collection of opt-in tools.
- Drizzle migrations: https://orm.drizzle.team/docs/migrations — supports database-first and codebase-first migration approaches; drizzle-kit is the CLI for migrations.
- Drizzle generate: https://orm.drizzle.team/docs/drizzle-kit-generate — `drizzle-kit generate` generates SQL migrations from Drizzle schema and can be applied with `drizzle-kit migrate` or external/direct tooling.
- Drizzle docs sidebar lists PostgreSQL and SQLite support and migration commands `generate`, `migrate`, `push`, `pull`, `export`, `check`, `up`, `studio`: https://orm.drizzle.team/docs/migrations.
- Kysely getting started: https://kysely.dev/docs/getting-started — requires TypeScript strict mode and a TypeScript `Database` interface for type safety.
- Kysely migrations: https://kysely.dev/docs/migrations — migrations are `up`/`down` functions using `Kysely<any>`, should be frozen in time, execute alphanumerically, and can use `FileMigrationProvider`/`Migrator`.
- npm registry:
  - https://registry.npmjs.org/drizzle-orm/latest: version 0.45.2, unpacked size 10,420,427 bytes, optional/peer driver ecosystem including `better-sqlite3`, `sqlite3`, `pg`, `postgres`, `@libsql/client`, etc.
  - https://registry.npmjs.org/drizzle-kit/latest: version 0.31.10, unpacked size 10,267,084 bytes, CLI bin `drizzle-kit`, dependencies include `esbuild` and `tsx`.
  - https://registry.npmjs.org/kysely/latest: version 0.29.2, unpacked size 1,723,760 bytes, no runtime dependencies observed, but `engines.node` is `>=22.0.0`.
  - https://registry.npmjs.org/kysely/0.28.8: version 0.28.8, unpacked size 3,248,654 bytes, `engines.node` is `>=20.0.0`.

Note: `web_search`/`web_extract` were unavailable due Firecrawl payment errors, so external evidence was gathered through browser-loaded primary docs and npm registry JSON.

## Decision matrix

| Criterion | Drizzle | Kysely | Result |
|---|---|---|---|
| SQLite + PostgreSQL coverage | First-class docs for PostgreSQL and SQLite connections; same ORM family and migration CLI across both. | Supports PostgreSQL/SQLite dialects via drivers; strong cross-dialect query builder. | Tie for database coverage. |
| Migration ergonomics | Stronger for this project: schema-as-code plus `drizzle-kit generate/check/migrate`; generated SQL can be reviewed and committed. | Migrator is solid but migration files are hand-authored `up`/`down` functions and should use `Kysely<any>` frozen in time; schema/type generation is a separate concern. | Drizzle. |
| TypeScript type safety | Schema declarations drive insert/select types; less duplication between schema and app types. | Excellent query type safety once the `Database` interface exists; interface must be hand-maintained or generated. | Drizzle for agent maintainability; Kysely for query-builder purists. |
| Testability | Generated SQL can be run in SQLite temp files and PostgreSQL test containers; schema modules are importable in tests. | Very testable; migrations are ordinary TS functions. | Tie/slight Kysely for handcrafted tests, but not enough to offset migration toil. |
| Agent maintainability | Agents can update Drizzle schema, generate SQL, inspect diff, and add tests. More repeatable. | Agents must keep Database interfaces, migrations, and possibly generated types aligned. More drift risk. | Drizzle. |
| Local runtime durability | Neither tool replaces explicit SQLite durability policy; Drizzle still allows raw SQL/driver setup for WAL, foreign keys, busy timeout, checkpoint. | Same. | Tie; must implement policy outside ORM. |
| Package footprint | Runtime package is larger (~10.4MB unpacked) and drizzle-kit is another ~10.3MB dev dependency; drivers still separate. | Smaller runtime (~1.7MB latest / ~3.25MB for Node 20-compatible 0.28.8), no deps observed. | Kysely. |
| Node compatibility | Latest registry metadata did not show a Node engine constraint in observed fields; repo Node >=20 is plausible. | Latest 0.29.2 requires Node >=22, conflicting with current repo Node >=20; Node 20 requires pinning 0.28.8. | Drizzle. |
| Existing project alignment | PRD/OpenSpec already reference Drizzle for central API and earlier foundation docs. | Would require updating project spec assumptions. | Drizzle. |

## Migration command names to implement

Root package commands:

```jsonc
{
  "scripts": {
    "db:generate:local": "drizzle-kit generate --config services/local-backend/drizzle.local.config.ts",
    "db:generate:central": "drizzle-kit generate --config services/central-api/drizzle.central.config.ts",
    "db:check:local": "drizzle-kit check --config services/local-backend/drizzle.local.config.ts",
    "db:check:central": "drizzle-kit check --config services/central-api/drizzle.central.config.ts",
    "db:migrate:local": "tsx services/local-backend/src/db/migrate-local.ts",
    "db:migrate:central": "tsx services/central-api/src/db/migrate-central.ts",
    "db:studio:local": "drizzle-kit studio --config services/local-backend/drizzle.local.config.ts",
    "db:studio:central": "drizzle-kit studio --config services/central-api/drizzle.central.config.ts"
  }
}
```

Rationale:

- Keep the PRD-required `pnpm db:migrate:local` and `pnpm db:migrate:central` names.
- Add explicit generate/check commands so migrations are generated and reviewed before apply.
- Use service-owned TS migration runners so local SQLite can enforce backup/export, WAL/foreign_keys/busy_timeout, and PostgreSQL can use the correct deployment connection policy.
- Avoid `drizzle-kit push` in normal development/CI for this project because kiosk DB migrations must be durable, reviewable, and rollback-aware. Reserve `push` for disposable prototypes only.

## File structure recommendation

Use separate DB packages per service; do not attempt one universal schema file for SQLite and PostgreSQL.

```text
services/
  local-backend/
    drizzle.local.config.ts
    src/
      db/
        schema/
          device-state.ts
          runtime-state.ts
          campaign-cache.ts
          schedule-cache.ts
          sessions.ts
          events.ts
          tickets.ts
          print-jobs.ts
          sync-queue.ts
          hardware-status.ts
          command-results.ts
          local-errors.ts
          index.ts
        migrations/
          meta/
          0000_initial_local.sql
        client.ts              # opens SQLite driver and applies PRAGMA policy
        migrate-local.ts       # explicit migration command; no implicit boot migration
        sqlite-policy.ts       # WAL, foreign_keys, busy_timeout, checkpoint helpers
        backup.ts              # pre-destructive backup/export helper
        seed-dev.ts            # fake/dev only, if needed

  central-api/
    drizzle.central.config.ts
    src/
      db/
        schema/
          locations.ts
          kiosks.ts
          kiosk-heartbeats.ts
          campaigns.ts
          activation-packages.ts
          campaign-schedules.ts
          sessions.ts
          events.ts
          tickets.ts
          device-commands.ts
          command-results.ts
          deployments.ts
          package-downloads.ts
          admin-users.ts
          admin-audit-log.ts
          index.ts
        migrations/
          meta/
          0000_initial_central.sql
        client.ts
        migrate-central.ts
        seed-dev.ts

packages/
  shared-types/
    src/
      db-ids.ts                # branded ids shared across DB/service boundaries
      events.ts
      tickets.ts
      commands.ts
```

Naming notes:

- The existing package uses `services/local-backend` script names, while PRD prose uses `local-runtime`. Keep current repo path unless a separate rename card changes it.
- Keep local and central migrations in service directories because SQLite and PostgreSQL schemas have overlapping concepts but different authority, constraints, and lifecycle.

## Implementation guardrails

1. SQLite local runtime:
   - Use WAL mode, foreign keys, busy timeout, explicit transactions, and checkpoint policy per PRD Addendum A4.
   - Migrations must not delete unsynced event/ticket/command data without an export/backup step.
   - Runtime service should fail fast or enter maintenance if migration cannot complete safely; do not auto-reset the local database.

2. PostgreSQL central API:
   - Enforce idempotency with unique constraints like `(kiosk_id, event_id)`, `(kiosk_id, ticket_id)`, `ticket_code`, and `(command_id, kiosk_id)` per PRD lines 580-587.
   - Keep event ingest append-only; use corrections/status transitions as new events where auditability matters.

3. CI:
   - Add SQLite migration validation by migrating an empty temp SQLite DB and checking PRAGMA/integrity basics.
   - Add PostgreSQL migration validation against a disposable Postgres service/container.
   - Run `pnpm db:check:local`, `pnpm db:check:central`, then migrate test DBs.

4. Developer workflow:
   - Change schema module.
   - Run `pnpm db:generate:local` or `pnpm db:generate:central`.
   - Review generated SQL.
   - Run `pnpm db:check:*`.
   - Run migration validation tests.
   - Commit schema + generated SQL + tests together.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Drizzle generated migrations miss a semantic intent such as a rename vs drop/create. | Data loss, especially dangerous for kiosk local DB. | Require human/agent SQL review; use `drizzle-kit check`; destructive local migrations require backup/export first. |
| SQLite and PostgreSQL schemas drift because they model similar entities. | Sync bugs and inconsistent analytics. | Keep service schemas separate but define shared IDs/envelopes in `packages/shared-types`; add tests for event/ticket payload compatibility. |
| ORM hides SQLite durability details. | Offline-for-days reliability could be compromised. | Put WAL/foreign key/busy timeout/checkpoint policy in `sqlite-policy.ts`; test it independently of Drizzle. |
| drizzle-kit/dev tooling footprint is larger than Kysely. | Slightly larger dev install; not a kiosk runtime blocker if only runtime bundle ships. | Keep `drizzle-kit` in devDependencies; bundle production service without CLI/studio. |
| Raw SQL still needed for advanced constraints/PRAGMAs. | Agents may overfit to ORM DSL. | Explicitly allow `sql``...`` fragments and generated SQL review; document when raw SQL is required. |
| Latest Drizzle API/docs are moving toward v1.0. | Upgrade churn. | Pin exact versions in `package.json`; make migration output committed and CI-validated. |
| Kysely latest requiring Node >=22 could tempt Node upgrade if Kysely is selected. | Conflicts with current repo Node >=20 baseline. | Avoid Kysely for v1; if selected anyway, pin `kysely@0.28.8` or raise repo engine in a separate decision. |

## Rejected alternative: Kysely

Kysely remains a good fallback if the team wants SQL-first hand-written migrations and a minimal runtime package. It is not recommended here because:

- the project already has Drizzle in OpenSpec/PRD assumptions;
- Drizzle better matches the D1 need for migration command names and repeatable agent workflow;
- Kysely type safety depends on a `Database` interface that must be maintained/generated separately;
- Kysely latest currently requires Node >=22 while this repo is Node >=20.

If Kysely is chosen despite this recommendation, implement:

- `packages/db-types` generated with `kysely-codegen` or a maintained equivalent;
- service-local `Migrator` scripts with `FileMigrationProvider`;
- ISO-8601 migration file naming;
- explicit Node version decision (`>=22` or pin Kysely 0.28.8).
