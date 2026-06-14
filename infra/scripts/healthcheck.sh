#!/usr/bin/env bash
set -euo pipefail
ENV_FILE=${1:-/etc/retail-kiosk/kiosk.env}
if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi
LOCAL_RUNTIME_URL=${LOCAL_RUNTIME_URL:-http://127.0.0.1:${LOCAL_BACKEND_PORT:-8787}}
KIOSK_LOG_DIR=${KIOSK_LOG_DIR:-/var/log/retail-kiosk}
SQLITE_PATH=${SQLITE_PATH:-/var/lib/retail-kiosk/runtime.sqlite}
TOKEN_SERIAL_PORT=${TOKEN_SERIAL_PORT:-/dev/retail-kiosk-token}
PRINTER_NAME=${PRINTER_NAME:-PT80KM}
printf '== retail kiosk healthcheck ==\n'
printf 'runtime_url=%s\n' "$LOCAL_RUNTIME_URL"
printf '\n-- systemd units --\n'
for unit in retail-kiosk-local-backend.service retail-kiosk-agent.service retail-kiosk-browser.service tailscaled.service cups.service; do
  systemctl is-active "$unit" 2>/dev/null || true
  systemctl --no-pager --lines=0 status "$unit" 2>/dev/null | sed -n '1,5p' || true
done
printf '\n-- local runtime HTTP --\n'
if command -v curl >/dev/null 2>&1; then
  curl -fsS --max-time 3 "$LOCAL_RUNTIME_URL/health" || true
  printf '\n'
else
  printf 'curl not installed\n'
fi
printf '\n-- ports --\n'
ss -ltnp 2>/dev/null || true
printf '\n-- disk/memory/uptime --\n'
df -h / /var/lib/retail-kiosk /var/log/retail-kiosk 2>/dev/null || df -h /
free -h || true
uptime || true
printf '\n-- hardware handles --\n'
ls -l "$TOKEN_SERIAL_PORT" /dev/serial/by-id/ 2>/dev/null || true
lpstat -p "$PRINTER_NAME" -l 2>/dev/null || lpstat -p 2>/dev/null || true
printf '\n-- data/log paths --\n'
ls -ld "$(dirname "$SQLITE_PATH")" "$KIOSK_LOG_DIR" 2>/dev/null || true
ls -lh "$SQLITE_PATH" 2>/dev/null || true
