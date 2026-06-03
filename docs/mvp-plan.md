# MVP Plan

## Phase 1 — Simulated Kiosk Prototype

Goal: prove the user flow and visual direction without hardware.

Deliverables:

- Vertical fullscreen app, 1080x1920 target.
- Fake coin insertion button.
- PixiJS/GSAP animated wheel.
- Question screen.
- Prize reveal.
- Fake thermal ticket print event.
- Local session/event log.

## Phase 2 — Local Backend

Goal: separate browser UI from game/hardware truth.

Deliverables:

- Node.js/Fastify local backend.
- Browser WebSocket connection.
- Local event queue.
- Session state machine.
- Fake hardware adapters for development.

## Phase 3 — Real Hardware Integration

Goal: connect the machine to real-world inputs/outputs.

Deliverables:

- Coin acceptor adapter.
- ESC/POS thermal printer adapter.
- Printer test endpoint.
- Hardware error reporting.
- Duplicate ticket prevention.

## Phase 4 — Central Control Plane

Goal: monitor and manage kiosks remotely.

Deliverables:

- PostgreSQL database.
- Central API.
- Kiosk registration.
- Heartbeat ingestion.
- Event sync.
- Basic admin dashboard.

## Phase 5 — Remote Operations

Goal: production-grade fleet control.

Deliverables:

- kiosk-agent systemd service.
- Remote restart browser/backend.
- Remote reboot.
- Log upload.
- Tailscale/WireGuard access.
- Maintenance mode.

## Phase 6 — Deployment and Rollback

Goal: safe updates in supermarket environments.

Deliverables:

- Versioned Docker images.
- Deploy command.
- Health check.
- Automatic rollback.
- Deployment center in admin dashboard.

## Open Decisions

- Kiosk OS and hardware model.
- Coin acceptor interface.
- Thermal printer model and interface.
- Whether MVP central backend uses Supabase-managed Postgres or self-hosted Postgres.
- Initial campaign/product branding.
- Whether Rive assets are needed or PixiJS/GSAP is sufficient.
