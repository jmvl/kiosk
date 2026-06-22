# Admin Dashboard

Vite React admin cockpit for kiosk operations.

## Sections

- **Central back office** — read-only fleet, kiosk, schedule, and deployment views backed by the central API. Configure `VITE_CENTRAL_API_BASE_URL` to enable these reads. The first slice calls:
  - `GET /v1/admin/fleet/overview`
  - `GET /v1/admin/kiosks`
  - `GET /v1/admin/schedules`
  - `GET /v1/admin/deployments`
- **Local kiosk tools** — existing local runtime telemetry, scheduler, game-run log, ticket, print, maintenance, and smoke-test controls.

The dashboard must show explicit empty or unavailable states when central data or control-plane tables are not available; do not seed fake central schedules or deployments in the UI.
