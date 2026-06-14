# Rollback runbook — runtime/player/agent scaffold

Status: application-level rollback scaffold. OS snapshot restore is emergency-only and must preserve unsynced records when possible.

Rollback preserves unsynced events/tickets/command results, active and previous known-good package, and logs needed for diagnosis. Do not delete `/var/lib/retail-kiosk` during app rollback.

## Prepare previous release

Before promotion of a new release:

```bash
sudo rsync -a /opt/retail-kiosk/current/ /opt/retail-kiosk/previous/
sudo test -f /opt/retail-kiosk/previous/package.json
```

## Roll back symlink-based deployment

Validate the kiosk environment file parses before touching `/opt` or systemd:

```bash
bash infra/scripts/rollback-runtime.sh --check-config /etc/retail-kiosk/kiosk.env
```

```bash
sudo bash infra/scripts/rollback-runtime.sh /etc/retail-kiosk/kiosk.env
```

Manual sequence:

```bash
sudo systemctl stop retail-kiosk-browser retail-kiosk-agent retail-kiosk-local-backend
sudo ln -sfn /opt/retail-kiosk/previous /opt/retail-kiosk/current
sudo systemctl daemon-reload
sudo systemctl start retail-kiosk-local-backend retail-kiosk-agent retail-kiosk-browser
```

## Verify after rollback

```bash
sudo systemctl status retail-kiosk-local-backend retail-kiosk-agent retail-kiosk-browser --no-pager
bash infra/scripts/healthcheck.sh /etc/retail-kiosk/kiosk.env
curl -fsS http://127.0.0.1:8787/health
journalctl -u retail-kiosk-local-backend -u retail-kiosk-agent -u retail-kiosk-browser --since '10 minutes ago' --no-pager
```

If the runtime DB schema was migrated destructively and rollback compatibility was not tested, block and preserve data instead of forcing an older runtime onto a newer database.

Emergency OS/image restore is last resort and must preserve or export unsynced local records and support logs when possible.
