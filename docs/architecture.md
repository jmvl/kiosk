# Architecture Blueprint

## High-Level Topology

```text
[Coin Acceptor]       [Thermal Printer]
      |                      |
      v                      v
+-------------------------------+
| Kiosk Device / Linux Mini-PC   |
|                               |
|  Firefox Kiosk Browser         |
|  - React/Vite UI               |
|  - PixiJS wheel/game canvas    |
|  - GSAP transitions            |
|                               |
|  Local Backend                 |
|  - Hardware I/O                |
|  - Game state                  |
|  - Prize/ticket control        |
|  - Local event queue           |
|  - WebSocket to browser        |
|                               |
|  Kiosk Agent                   |
|  - Heartbeat                   |
|  - Remote commands             |
|  - Restart/reboot/deploy       |
|  - Log upload                  |
+-------------------------------+
      |
      | Internet when available
      v
+-------------------------------+
| Central Control Plane          |
|                               |
|  API                           |
|  PostgreSQL                    |
|  Admin Dashboard               |
|  Realtime command channel      |
|  Deployment/version registry   |
|  Analytics/events              |
+-------------------------------+
```

## Runtime Flow

1. Kiosk boots.
2. systemd starts local backend, kiosk-agent, and Firefox in kiosk mode.
3. Browser opens local kiosk UI.
4. Backend confirms printer/coin acceptor status.
5. Kiosk enters idle attract mode.
6. Coin event arrives from hardware.
7. Backend creates a local session and notifies frontend.
8. User spins wheel.
9. Frontend displays animation; backend remains source of truth for session/prize.
10. Quiz/question flow runs.
11. Backend records result and sends print command.
12. Thermal ticket prints.
13. Events sync to central backend.
14. Kiosk resets.

## Backend Services

### Kiosk local backend

Responsibilities:

- Hardware abstraction for coin acceptor.
- ESC/POS printer integration.
- Local session state machine.
- Prize rules enforcement.
- Offline event queue.
- Browser WebSocket events.
- Local health endpoint.

Suggested ports:

- `127.0.0.1:8787` — local API
- `127.0.0.1:8787/ws` — local browser WebSocket

### Kiosk agent

Responsibilities:

- Heartbeat to central control plane.
- System metrics: CPU, RAM, disk, temperature if available.
- App metrics: frontend/backend status, current app version.
- Hardware metrics: printer status, paper/error if available, coin acceptor status.
- Remote command execution:
  - restart browser
  - restart backend
  - reboot kiosk
  - deploy version
  - rollback version
  - upload logs
  - test print
  - maintenance mode

### Central API

Responsibilities:

- Kiosk registration.
- Campaign configuration.
- Event ingestion.
- Device command scheduling.
- Deployment metadata.
- Admin dashboard API.
- Authentication and authorization.

## Realtime Channel

MVP:

- WebSocket from kiosk-agent to central API.

Production:

- MQTT or NATS.

MQTT-style topics:

- `kiosks/{kiosk_id}/status`
- `kiosks/{kiosk_id}/events`
- `kiosks/{kiosk_id}/commands`
- `kiosks/{kiosk_id}/command-results`

## Database Recommendation

Use PostgreSQL as canonical database.

Supabase may be used for MVP speed, but only behind our API boundary. Do not make the kiosk frontend/backend depend directly on Supabase to play the game or print tickets.

## Deployment/Rollback

Kiosk should run Docker images or systemd-managed services with versioned releases.

Minimum release strategy:

- `current` version
- `previous` version
- health check after deploy
- automatic rollback on failed health check
- admin-visible deployment state

## Security Principles

- Browser has no admin credentials.
- Prize logic is not trusted from frontend only.
- Local API binds to localhost by default.
- Remote commands are authenticated, authorized, signed or strongly scoped, and audited.
- Tailscale/WireGuard used for emergency SSH/admin access.
- No inbound public ports on supermarket network.
- Every reboot/deploy/rollback/test-print is logged.
