# Retail Kiosk Activation

Monorepo skeleton for the kiosk operating layer implementation.

Local CI baseline:

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The root `pnpm ci` script runs the same checks with `--frozen-lockfile` for CI.

Package skeletons:

- `apps/kiosk-player`
- `apps/admin-dashboard`
- `services/local-backend`
- `services/central-api`
- `services/kiosk-agent`
- `packages/shared-types`
- `packages/campaign-schema`

This repository is currently at gate I1. Package contents are intentionally limited to tooling smoke exports and tests; business logic belongs in later implementation gates.
