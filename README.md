# P'tit Lion Kiosk

Browser-first arcade fortune kiosk for the Linux Mint machine at `192.168.1.117`.

This repo replaces the old Electron slot-machine MVP with:

- Vite + React fullscreen kiosk UI
- PixiJS for the animated wheel, lions, particles, and WebGL/canvas graphics
- GSAP for spin and reveal timelines
- Python hardware bridge for coin slot, barcode scanner, and thermal printer
- Firefox kiosk mode on Linux

## Hardware

Known kiosk devices:

```text
Coin slot: /dev/serial/by-id/usb-1a86_USB_Serial-if00-port0
Scanner:   /dev/input/by-id/usb-usbd_USB_HID_KEYBOARD_000000-event-kbd
Printer:   CUPS queue ICOD-PT80KM
```

The kiosk user must be in:

```text
dialout  # coin serial
input    # scanner evdev
lpadmin  # printer administration
```

## Development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Run the hardware bridge in another terminal:

```bash
python3 hardware/ptit_lion_server.py --no-coin-monitor --no-scanner-monitor
```

The frontend defaults to `http://localhost:8787` for hardware events during Vite development.

Test event endpoints:

```bash
curl 'http://localhost:8787/api/simulate-coin'
curl 'http://localhost:8787/api/simulate-scan?payload=2504711954'
```

A scanner payload ending in `954` greets Jean-Michel and starts a free member spin.

## Production Kiosk

Build and serve the app through the hardware bridge:

```bash
npm run kiosk
```

On the Linux kiosk, use:

```bash
scripts/start-ptit-lion-kiosk.sh
```

The launcher:

- builds `dist/` if missing
- starts `hardware/ptit_lion_server.py` on port `8787`
- opens Firefox in kiosk mode at `http://127.0.0.1:8787`

## Current Direction

Use `rgbKineticSlider` as visual inspiration only. The actual kiosk engine is PixiJS + GSAP so the app can control real-time hardware events, prize state, scan/member flows, and thermal printing reliably.
