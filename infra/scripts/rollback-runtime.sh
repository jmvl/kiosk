#!/usr/bin/env bash
set -euo pipefail
CHECK_CONFIG=false
if [[ "${1:-}" == "--check-config" ]]; then
  CHECK_CONFIG=true
  shift
fi
ENV_FILE=${1:-/etc/retail-kiosk/kiosk.env}
if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi
KIOSK_APP_DIR=${KIOSK_APP_DIR:-/opt/retail-kiosk/current}
KIOSK_PREVIOUS_DIR=${KIOSK_PREVIOUS_DIR:-/opt/retail-kiosk/previous}
if [[ "$CHECK_CONFIG" == true ]]; then
  printf 'rollback config parse ok\n'
  printf 'env_file=%s\n' "$ENV_FILE"
  printf 'kiosk_app_dir=%s\n' "$KIOSK_APP_DIR"
  printf 'kiosk_previous_dir=%s\n' "$KIOSK_PREVIOUS_DIR"
  exit 0
fi
if [[ ! -d "$KIOSK_PREVIOUS_DIR" ]]; then
  echo "Previous release directory not found: $KIOSK_PREVIOUS_DIR" >&2
  exit 1
fi
sudo systemctl stop retail-kiosk-browser.service retail-kiosk-agent.service retail-kiosk-local-backend.service || true
if [[ -L "$KIOSK_APP_DIR" ]]; then
  sudo ln -sfn "$KIOSK_PREVIOUS_DIR" "$KIOSK_APP_DIR"
else
  echo "$KIOSK_APP_DIR is not a symlink; use the manual rollback runbook to preserve current data." >&2
  exit 1
fi
sudo systemctl daemon-reload
sudo systemctl start retail-kiosk-local-backend.service retail-kiosk-agent.service retail-kiosk-browser.service
sudo systemctl --no-pager --lines=20 status retail-kiosk-local-backend.service retail-kiosk-agent.service retail-kiosk-browser.service
