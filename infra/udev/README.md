# Retail kiosk udev notes

Status: template-only scaffold. Do not claim CH340/token-reader readiness until the O0/Q4 hardware evidence gate has captured the real device ID, serial behavior, permissions, and runtime event flow.

## Artifact

- `99-retail-kiosk-ch340.rules.template` — starter rule for the known CH340 USB serial baseline (`1a86:7523`, `ch341` driver) that creates `/dev/retail-kiosk-token` for the `kiosk-runtime` group.

## Evidence required before install

On the actual kiosk host, capture and review:

```bash
lsusb
udevadm info --attribute-walk --name /dev/ttyUSB0
udevadm test /sys/class/tty/ttyUSB0 2>&1 | tee /tmp/retail-kiosk-udev-test.log
id kiosk
getent group kiosk-runtime
```

If the adapter exposes a stable serial, add an `ATTRS{serial}=="..."` guard before installing the rule so another CH340 device cannot accidentally become the token reader.

## Install after evidence review

```bash
sudo install -o root -g root -m 0644 infra/udev/99-retail-kiosk-ch340.rules.template /etc/udev/rules.d/99-retail-kiosk-ch340.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=tty
ls -l /dev/retail-kiosk-token
```

Expected post-install shape only: `/dev/retail-kiosk-token` exists, points at the reviewed token reader, and is group-writable by `kiosk-runtime`. This file does not certify physical token-reader behavior; application readiness still needs an end-to-end O0/Q4 test.
