# Log collection runbook

Goal: gather enough evidence for support without leaking secrets or deleting local audit data.

## Quick status

```bash
bash infra/scripts/healthcheck.sh /etc/retail-kiosk/kiosk.env
```

## Create support bundle

```bash
sudo bash infra/scripts/collect-logs.sh /etc/retail-kiosk/kiosk.env /tmp
```

The script prints the archive path, for example `/tmp/retail-kiosk-logs-hq-001-20260612T120000Z.abcd.tgz`.

Bundle contents: systemd status for kiosk/CUPS/Tailscale, last 24 hours of relevant journals, disk/memory/listener summaries, CUPS status, Tailscale status JSON when available, kiosk log directory archive, and local DB file inventory only.

The bundle intentionally does not copy `/etc/retail-kiosk/secrets`, device credential files, ticket signing keys, or raw SQLite databases.

Manual commands:

```bash
journalctl -u retail-kiosk-local-backend -u retail-kiosk-agent -u retail-kiosk-browser --since '2 hours ago' --no-pager
lpstat -t
systemctl status retail-kiosk.target --no-pager
ss -ltnp
```

If raw database evidence is needed, export a redacted diagnostic report from the runtime instead of copying the DB into general support bundles.
