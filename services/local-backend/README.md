# Local Backend

Local-first kiosk backend for hardware-safe runtime control. The browser/player is presentation only; this service owns local session, event, ticket, hardware, schedule, and print truth.

Current scope:

- Fastify API on `127.0.0.1:8787` by default.
- Auth/CORS guard using optional `LOCAL_BACKEND_AUTH_TOKEN` and `LOCAL_BACKEND_ALLOWED_ORIGINS`.
- Runtime state and event persistence in SQLite with monotonic local event sequences.
- Player/runtime endpoints for sessions, quiz answers, spins, tickets, prints, maintenance, and schedules.
- WebSocket state broadcasts for kiosk UI/runtime updates.
- Admin/local ops endpoints including telemetry, game runs, campaign preview, and `GET /admin/api/events/export` for central sync.
- Fake and real hardware adapter paths for token input and CUPS printing.

`GET /admin/api/events/export` returns authenticated append-only event envelopes after `after_sequence`, capped by `limit`, plus a cursor with the next acknowledged local sequence for kiosk-agent uploads.
