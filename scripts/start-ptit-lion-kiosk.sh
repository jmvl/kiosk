#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/yr/kiosk}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8787}"
URL="${URL:-http://127.0.0.1:${PORT}}"
COIN_SERIAL="${COIN_SERIAL:-/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0}"
SCANNER_DEVICE="${SCANNER_DEVICE:-/dev/input/by-id/usb-usbd_USB_HID_KEYBOARD_000000-event-kbd}"
PRINTER_API_URL="${PRINTER_API_URL:-http://192.168.1.10:3000}"
CUPS_PRINTER="${CUPS_PRINTER:-ICOD-PT80KM}"
DISPLAY="${DISPLAY:-:0}"
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"
SERVER_LOG="${SERVER_LOG:-${APP_DIR}/ptit-lion-server.log}"
FIREFOX_LOG="${FIREFOX_LOG:-${APP_DIR}/ptit-lion-firefox.log}"
RESTART_FIREFOX="${RESTART_FIREFOX:-1}"
RESTART_SERVER="${RESTART_SERVER:-1}"

cd "$APP_DIR"

if [ ! -f dist/index.html ]; then
  npm run build
fi

if [ "$RESTART_SERVER" = "1" ]; then
  pkill -u "$(id -un)" -f "ptit_lion_server.py .*--port ${PORT}" 2>/dev/null || true
  pkill -u "$(id -un)" -f "server.py .*--port ${PORT}" 2>/dev/null || true
  for _ in $(seq 1 40); do
    if ! pgrep -u "$(id -un)" -f "ptit_lion_server.py .*--port ${PORT}|server.py .*--port ${PORT}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

nohup python3 -u hardware/ptit_lion_server.py \
  --host "$HOST" \
  --port "$PORT" \
  --static-dir "${APP_DIR}/dist" \
  --coin-serial "$COIN_SERIAL" \
  --scanner-device "$SCANNER_DEVICE" \
  --printer-api "$PRINTER_API_URL" \
  --cups-printer "$CUPS_PRINTER" \
  > "$SERVER_LOG" 2>&1 < /dev/null &
SERVER_PID="$!"

for _ in $(seq 1 80); do
  if curl -fsS "$URL/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -fsS "$URL/" >/dev/null 2>&1; then
  echo "P'tit Lion server did not become ready; see $SERVER_LOG" >&2
  exit 1
fi

if [ "$RESTART_FIREFOX" = "1" ]; then
  pkill -u "$(id -un)" -f "firefox.*${PORT}|firefox-esr.*${PORT}" 2>/dev/null || true
fi

if command -v firefox >/dev/null 2>&1; then
  FIREFOX_BIN="${FIREFOX_BIN:-$(command -v firefox)}"
elif command -v firefox-esr >/dev/null 2>&1; then
  FIREFOX_BIN="${FIREFOX_BIN:-$(command -v firefox-esr)}"
else
  echo "firefox not found" >&2
  exit 1
fi

nohup env \
  DISPLAY="$DISPLAY" \
  XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
  DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" \
  "$FIREFOX_BIN" --kiosk "$URL" \
  > "$FIREFOX_LOG" 2>&1 < /dev/null &
FIREFOX_PID="$!"

echo "P'tit Lion server PID: $SERVER_PID"
echo "Firefox kiosk PID: $FIREFOX_PID"
echo "URL: $URL"
echo "Server log: $SERVER_LOG"
echo "Firefox log: $FIREFOX_LOG"
