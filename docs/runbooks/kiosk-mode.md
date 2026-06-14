# Kiosk mode runbook — Chromium fullscreen

Status: configurable scaffold. Browser package/channel, display rotation, touch calibration, and final target user/path still need target confirmation.

`infra/systemd/retail-kiosk-browser.service` starts Chromium using values from `/etc/retail-kiosk/kiosk.env`:

```text
KIOSK_BROWSER_BIN=/usr/bin/chromium-browser
KIOSK_BROWSER_FLAGS="--kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000"
PLAYER_ORIGIN=http://127.0.0.1:8787/player
DISPLAY=:0
XAUTHORITY=/home/kiosk/.Xauthority
```

Verify browser binary:

```bash
command -v chromium-browser || command -v chromium || command -v google-chrome || command -v google-chrome-stable
```

The service assumes the `kiosk` user has a graphical session and valid Xauthority. Configure autologin only after target OS/display manager confirmation.

Evidence commands:

```bash
loginctl list-sessions
loginctl show-user kiosk
sudo -u kiosk test -r /home/kiosk/.Xauthority && echo xauthority-ok
sudo systemctl restart retail-kiosk-browser
sudo systemctl status retail-kiosk-browser --no-pager
journalctl -u retail-kiosk-browser --since '5 minutes ago' --no-pager
```

Hardening checklist: disable sleep/blanking, hide browser crash prompts, verify browser restart after kill/reboot, verify local runtime reachability, and confirm no dev/manual bypass UI is visible in production mode.
