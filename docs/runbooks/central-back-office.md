# Central back office runbook

Status: Hermes-node bootstrap runbook for read-only central monitoring and static admin hosting.

## Scope

The central back office is the Hermes-node control plane for kiosk fleet monitoring. The kiosk-local `/admin` remains an emergency/local operator console. Central configure/deploy writes remain disabled until auth, roles, audit, deployment tables, and rollback are implemented.

## Current bootstrap service

User service template:

```text
infra/systemd/retail-kiosk-central-api.service
```

Runtime service on Hermes:

```bash
systemctl --user status retail-kiosk-central-api.service --no-pager
```

Default bootstrap port:

```text
8877
```

Admin URL on Hermes LAN:

```text
http://192.168.1.240:8877/admin/
```

Tailscale URL, when reachable from the client:

```text
http://100.120.193.24:8877/admin/
```

## Environment

The user service reads:

```text
~/.config/retail-kiosk-central/central-api.env
```

Required fields for the bootstrap deployment:

```bash
PORT=8877
CENTRAL_ADMIN_STATIC_DIR=/home/ubuntu/projects/retail-kiosk-activation/apps/admin-dashboard/dist-web
```

Recommended production field:

```bash
CENTRAL_DATABASE_URL=postgres://retail_kiosk_central:<secret>@127.0.0.1:55432/retail_kiosk_central
```

If `CENTRAL_DATABASE_URL` is absent, the central API uses the in-memory repository. That is acceptable only for short bootstrap tests because heartbeats/events are lost on restart.

## Build and restart

```bash
pnpm --filter @retail-kiosk/central-api build
pnpm --filter @retail-kiosk/admin-dashboard build
systemctl --user daemon-reload
systemctl --user restart retail-kiosk-central-api.service
```

## Smoke verification

```bash
curl -fsS http://127.0.0.1:8877/healthz
curl -fsS http://127.0.0.1:8877/v1/admin/fleet/overview
curl -fsS http://127.0.0.1:8877/admin/
```

Expected:

- `/healthz` returns `{ "ok": true }`.
- `/v1/admin/fleet/overview` returns live central fleet JSON.
- `/admin/` returns the built React admin HTML.

## Kiosk-agent connection

Point the physical kiosk agent at the Hermes central API:

```bash
CENTRAL_API_BASE_URL=http://192.168.1.240:8877
```

Then verify:

```bash
curl -fsS http://127.0.0.1:8877/v1/admin/kiosks
curl -fsS 'http://127.0.0.1:8877/v1/admin/events?limit=20'
```

A real token/quiz/spin/ticket/print/reset cycle should upload heartbeats/events through the kiosk agent and appear in these central endpoints.

## Guardrails

- Do not expose mutation routes publicly before DB-backed auth, roles, and audit exist.
- Do not claim configure/deploy is live until central schedules/deployments are table-backed and the kiosk agent supports staged package/schedule activation with rollback evidence.
- Do not use in-memory mode for production reporting.
- Do not treat kiosk-local `/admin` as central back office.

## Current write capability status

Central write/config/deploy workflows are intentionally not live yet:

- campaign/ticket editor: planned, not implemented
- bitmap/logo upload: planned, not implemented
- deployment publish/rollback: planned, not implemented
- command enqueue from admin: intentionally unsupported until auth/audit

The current Hermes-node milestone is read-only live monitoring plus admin static hosting.
