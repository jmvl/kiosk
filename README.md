# Retail Kiosk Activation Platform

Working project folder for the supermarket promotional kiosk concept.

## Concept

A vertical touchscreen kiosk in a supermarket runs a branded promotional game:

1. User approaches kiosk.
2. Kiosk shows an animated attract screen with product/logo visuals.
3. User inserts a coin.
4. Machine unlocks the game.
5. User spins a wheel.
6. Kiosk asks a question.
7. User receives a result/prize.
8. Machine prints a thermal ticket.
9. Session resets for the next user.

## Strategic Direction

This should be built as a **managed retail kiosk platform**, not just an animated website.

Core principles:

- Local-first: kiosk must keep working if internet fails.
- Remote-managed: admins must monitor, reboot, redeploy, and recover devices remotely.
- Hardware-safe: coin acceptor and thermal printer are controlled by a local backend, not browser JavaScript.
- Brand-first: PixiJS/GSAP/Rive-style graphics for premium visual experience.
- Audit-friendly: every coin, spin, answer, prize, and printed ticket is logged.

## Recommended Technology

### Kiosk device

- Linux mini-PC
- Firefox kiosk mode
- Docker or systemd services
- Tailscale/WireGuard for secure remote access

### Frontend

- Vite + React or similar
- Vertical fullscreen layout, likely 1080x1920
- PixiJS for canvas/WebGL game graphics
- GSAP for animation choreography
- Optional Rive for premium interactive brand animations

### Local backend

- Node.js/Fastify or Go
- Talks to coin acceptor and printer
- Exposes localhost API/WebSocket to frontend
- Maintains local queue for offline events
- Syncs to central backend when online

### Central backend

- PostgreSQL as canonical database
- Custom API/control plane
- Admin dashboard
- WebSocket for MVP realtime; MQTT/NATS for production fleet
- Object storage for media/log bundles if needed

### Supabase Position

Supabase is acceptable as an MVP accelerator for auth/admin/database, but should not become the kiosk runtime dependency. The kiosk should talk to our API; our API can write to PostgreSQL/Supabase behind the scenes. This preserves migration flexibility and protects offline operation.

## Reference Visual Inspiration

- `hmongouachon/rgbKineticSlider`: kinetic RGB image slider style for promotional/brand activation visuals.
- HyperFrames: useful for exported promo/idle videos, not the kiosk engine.
- Motion Canvas 2D: useful for storyboard/prototype/explainer assets, not primary runtime.
- PixiJS + GSAP: recommended for actual live kiosk game graphics.

## Project Folders

This project is now structured as a reusable multi-campaign kiosk platform foundation:

- `apps/kiosk-player/` — fullscreen campaign player for the retail kiosk screen.
- `apps/admin-dashboard/` — future fleet, campaign, deployment, and audit dashboard.
- `services/local-backend/` — local-first hardware-safe API, WebSocket, and event queue.
- `services/central-api/` — future canonical backend/control plane.
- `services/kiosk-agent/` — future heartbeat, remote ops, log upload, and deployment agent.
- `packages/campaign-schema/` — reusable campaign manifest contracts.
- `campaigns/chocomel/` — first campaign package, currently prototype/reference only.
- `docs/` — architecture, backend, data model, admin, deployment, and brainstorming notes.

## Immediate Next Steps

1. Confirm kiosk screen resolution and OS.
2. Confirm coin acceptor interface: USB, serial, GPIO, or pulse.
3. Confirm thermal printer model/interface and ESC/POS compatibility.
4. Build simulated prototype: fake coin button, wheel, question, fake print.
5. Add local backend event queue.
6. Add admin dashboard heartbeat view.
7. Integrate real hardware.
