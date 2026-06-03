# References

## Visual / Animation

- rgbKineticSlider: https://github.com/hmongouachon/rgbKineticSlider
  - Kinetic RGB image slider reference for premium promotional/brand activation visuals.

## Candidate Animation Technologies

- PixiJS: https://pixijs.com/
  - Recommended primary engine for live wheel/game canvas graphics.

- GSAP: https://gsap.com/
  - Recommended for motion choreography, transitions, timelines.

- Rive: https://rive.app/
  - Optional for designer-authored interactive vector/brand animation.

- Motion Canvas: https://motioncanvas.io/
  - Useful for presentation-style animation/storyboards; not recommended as primary kiosk runtime.

- HyperFrames: https://github.com/heygen-com/hyperframes
  - Useful for exported promo/idle videos; not recommended as primary kiosk runtime.

## Infrastructure Concepts

- PostgreSQL canonical database.
- Local-first kiosk backend with offline queue.
- WebSocket for MVP command/status channel.
- MQTT or NATS for production fleet command/status.
- Tailscale or WireGuard for secure remote access.
- Docker/systemd for reliable deployment and restart.
