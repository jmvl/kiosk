#!/usr/bin/env bash
set -euo pipefail
ENV_FILE=${1:-/etc/retail-kiosk/kiosk.env}
OUT_DIR=${2:-/tmp}
if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi
KIOSK_ID=${KIOSK_ID:-unknown-kiosk}
KIOSK_LOG_DIR=${KIOSK_LOG_DIR:-/var/log/retail-kiosk}
KIOSK_DATA_DIR=${KIOSK_DATA_DIR:-/var/lib/retail-kiosk}
TS=$(date -u +%Y%m%dT%H%M%SZ)
BUNDLE_DIR=$(mktemp -d "${OUT_DIR%/}/retail-kiosk-logs-${KIOSK_ID}-${TS}.XXXXXX")
mkdir -p "$BUNDLE_DIR"
{
  echo "kiosk_id=$KIOSK_ID"
  echo "timestamp_utc=$TS"
  echo "hostname=$(hostname)"
  echo "kernel=$(uname -a)"
  echo "uptime=$(uptime || true)"
} > "$BUNDLE_DIR/manifest.txt"
systemctl --no-pager status retail-kiosk.target retail-kiosk-local-backend.service retail-kiosk-agent.service retail-kiosk-browser.service tailscaled.service cups.service > "$BUNDLE_DIR/systemd-status.txt" 2>&1 || true
journalctl --no-pager -u retail-kiosk-local-backend.service -u retail-kiosk-agent.service -u retail-kiosk-browser.service --since '24 hours ago' > "$BUNDLE_DIR/journal-retail-kiosk.log" 2>&1 || true
journalctl --no-pager -u tailscaled.service -u cups.service --since '24 hours ago' > "$BUNDLE_DIR/journal-network-printer.log" 2>&1 || true
df -h > "$BUNDLE_DIR/df-h.txt" 2>&1 || true
free -h > "$BUNDLE_DIR/free-h.txt" 2>&1 || true
ss -ltnp > "$BUNDLE_DIR/listeners.txt" 2>&1 || true
lpstat -t > "$BUNDLE_DIR/lpstat.txt" 2>&1 || true
tailscale status --json > "$BUNDLE_DIR/tailscale-status.json" 2>&1 || true
if [[ -d "$KIOSK_LOG_DIR" ]]; then
  tar -C "$KIOSK_LOG_DIR" -czf "$BUNDLE_DIR/retail-kiosk-logdir.tgz" . 2>/dev/null || true
fi
find "$KIOSK_DATA_DIR" -maxdepth 2 -type f \( -name '*.sqlite' -o -name '*.db' -o -name '*.sqlite-wal' \) -printf '%p %s bytes\n' > "$BUNDLE_DIR/local-db-inventory.txt" 2>/dev/null || true
ARCHIVE="${BUNDLE_DIR}.tgz"
tar -C "$(dirname "$BUNDLE_DIR")" -czf "$ARCHIVE" "$(basename "$BUNDLE_DIR")"
printf '%s\n' "$ARCHIVE"
