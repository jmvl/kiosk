# Local install runbook — HQ kiosk scaffold

Status: scaffold for review. This does not prove physical hardware readiness.

## Target assumptions

- OS: Ubuntu LTS or Linux Mint 22.x family.
- Process manager: systemd.
- App path: configurable; default `/opt/retail-kiosk/current`.
- Previous release path: configurable; default `/opt/retail-kiosk/previous`.
- Config path: `/etc/retail-kiosk/kiosk.env`.
- Data path: `/var/lib/retail-kiosk`.
- Log path: `/var/log/retail-kiosk`.
- Local runtime binds to `127.0.0.1`, default port `8787`.
- No checked-in secrets; device credentials and ticket-signing keys are provisioned separately.

## Build on the repo host

```bash
cd /path/to/retail-kiosk-activation
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

## Manual install outline

1. Create a `kiosk-runtime` group and `kiosk` service/desktop user.
2. Create `/etc/retail-kiosk`, `/etc/retail-kiosk/secrets`, `/var/lib/retail-kiosk`, `/var/log/retail-kiosk`, and `/opt/retail-kiosk` with restrictive ownership.
3. Copy `infra/systemd/retail-kiosk.env.example` to `/etc/retail-kiosk/kiosk.env` and edit per device.
4. Copy the unit templates from `infra/systemd/` into `/etc/systemd/system/`.
5. Run `systemctl daemon-reload`, then enable `retail-kiosk.target` only after config review.

Minimum fake-mode config for HQ software smoke:

```text
KIOSK_ID=hq-001
LOCATION_ID=hq
KIOSK_APP_DIR=/opt/retail-kiosk/current
LOCAL_BACKEND_PORT=8787
HARDWARE_MODE=fake
TOKEN_ADAPTER=fake
PRINTER_ADAPTER=fake
```

Switch hardware mode only after O0 confirms real serial/CUPS evidence.

## Enable services

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now retail-kiosk.target
sudo systemctl status retail-kiosk.target --no-pager
sudo systemctl status retail-kiosk-local-backend retail-kiosk-agent retail-kiosk-browser --no-pager
```

## Verify

```bash
bash infra/scripts/healthcheck.sh /etc/retail-kiosk/kiosk.env
curl -fsS http://127.0.0.1:8787/health
journalctl -u retail-kiosk-local-backend -u retail-kiosk-agent -u retail-kiosk-browser --since '10 minutes ago' --no-pager
```

If the `/health` endpoint is not implemented yet on the current branch, systemd syntax and process supervision can still be reviewed, but do not call the runtime healthy.
