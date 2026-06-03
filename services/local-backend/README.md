# Local Backend

Local-first kiosk backend for hardware-safe control.

Current foundation:

- Fastify API on `127.0.0.1:8787`
- WebSocket heartbeat endpoint
- Simulated coin insertion endpoint
- Simulated thermal print endpoint
- In-memory event log for MVP prototype

This service is the future owner of coin/prize/print truth. The browser is presentation only.
