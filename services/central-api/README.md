# Central API

Bootstrap central backend/control plane for kiosk heartbeats, event ingestion, device command polling, and read-only admin dashboard API surfaces.

Current scope:

- `POST /v1/heartbeats` stores latest kiosk health and versions.
- `POST /v1/events/batch` ingests append-only kiosk event envelopes idempotently.
- `GET /v1/kiosks/:kiosk_id/commands` and `POST /v1/commands/:command_id/result` support kiosk command polling/results.
- `GET /v1/admin/fleet/overview`, `/v1/admin/kiosks`, `/v1/admin/kiosks/:kiosk_id`, `/v1/admin/schedules`, `/v1/admin/deployments`, and `/v1/admin/events` provide read-only central dashboard data.

Bootstrap admin access:

- The `/v1/admin/*` read endpoints are intentionally unauthenticated in this bootstrap slice so a LAN-hosted dashboard can read the central API before identity/roles land.
- The server returns CORS headers and handles `OPTIONS` preflight for cross-origin dashboard reads. Do not expose this bootstrap service beyond the trusted LAN without adding authentication and a restricted origin allowlist.
