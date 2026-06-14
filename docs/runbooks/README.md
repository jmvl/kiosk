# Kiosk ops runbooks

These runbooks are deployment scaffolding for the HQ pilot. They are actionable on Ubuntu/Linux Mint-family targets but do not claim real hardware readiness. Physical readiness still requires the O0/Q4 evidence gate from `docs/implementation-addendum-v1.md`.

Runbooks:

- `local-install.md` — target layout, service install, build/deploy sequence.
- `kiosk-mode.md` — Chromium fullscreen boot and desktop/session assumptions.
- `cups-printer.md` — ICOD/PT80KM CUPS setup and evidence checklist.
- `tailscale.md` — tailnet enrollment and remote access boundaries.
- `log-collection.md` — support bundle collection without secrets.
- `rollback.md` — app/runtime rollback basics and verification.
