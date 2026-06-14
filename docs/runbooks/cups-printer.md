# CUPS printer setup runbook — ICOD/PT80KM baseline

Status: scaffold only. No physical print readiness is claimed until O0/Q4 evidence exists.

Baseline: ICOD/PT80KM or compatible 80mm thermal printer, CUPS adapter first, queue name `ICOD-PT80KM` or `PT80KM`, paper profile still to be proven.

## Install and discover

```bash
sudo apt-get update
sudo apt-get install -y cups system-config-printer-common
sudo systemctl enable --now cups
sudo usermod -aG lp,lpadmin kiosk
lsusb
lpinfo -v
sudo dmesg --ctime | grep -i -E 'usb|printer|lp|usblp|pt80|icod' | tail -100
```

## Add queue

Example only; replace the USB URI and driver/PPD after target evidence:

```bash
sudo lpadmin -p PT80KM -E -v 'usb://REPLACE-WITH-LPINFO-URI' -m everywhere
sudo lpoptions -d PT80KM
lpstat -p PT80KM -l
```

## Test print evidence

```bash
printf 'Retail kiosk printer smoke test\nKiosk: hq-001\nUTC: %s\n' "$(date -u +%FT%TZ)" > /tmp/kiosk-printer-test.txt
lp -d PT80KM /tmp/kiosk-printer-test.txt
lpstat -W completed -o PT80KM | tail
journalctl -u cups --since '10 minutes ago' --no-pager
```

Record queue name, driver/PPD, paper width, printable width, cutter behavior, QR/barcode readability, and CUPS errors. Do not enable real sessions if printer is offline before token input.
