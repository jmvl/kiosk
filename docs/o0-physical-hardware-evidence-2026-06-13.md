# O0 Physical Hardware Evidence Spike — 2026-06-13

Task: `t_01fb3d4f`
Host inspected: `ubuntu-hermes-01`
Workspace: `/home/ubuntu/projects/retail-kiosk-activation`
Timestamp: `2026-06-13T01:32:33+02:00`

## Result

No physical kiosk hardware evidence was available on this host. Only USB root hubs were visible. No CH340/CH341 token adapter, no `/dev/serial/by-id`, no `/dev/ttyUSB*`/`/dev/ttyACM*`, no CUPS tools/service, and no ICOD/PT80KM queue were detected.

Therefore real hardware readiness remains blocked. Fake-flow work may continue, but I10/Q4 real-adapter readiness must not be claimed until the missing HQ/operator evidence below is captured on a machine with the real hardware attached.

## Commands and observed outputs

### Workspace and host

```text
$ cd /home/ubuntu/projects/retail-kiosk-activation && pwd && git status --short --branch && hostname && date -Is && uname -a
/home/ubuntu/projects/retail-kiosk-activation
## foundations
 M package.json
 M packages/campaign-schema/package.json
 M packages/campaign-schema/src/index.ts
 M packages/campaign-schema/test/smoke.test.mjs
 M packages/shared-types/package.json
 M packages/shared-types/src/index.ts
 M packages/shared-types/test/smoke.test.mjs
 M pnpm-lock.yaml
 M services/central-api/package.json
 M services/central-api/src/index.ts
 M services/central-api/test/smoke.test.mjs
 M services/local-backend/package.json
 M services/local-backend/src/index.ts
 M services/local-backend/test/smoke.test.mjs
?? .codex/
?? campaigns/chocomel/assets/
?? campaigns/chocomel/manifest.json
?? campaigns/chocomel/module/
?? campaigns/chocomel/ticket-template/
?? docs/runbooks/
?? infra/
?? packages/campaign-schema/scripts/
?? packages/campaign-schema/src/manifest.ts
?? packages/campaign-schema/src/validate.ts
?? packages/campaign-schema/test/manifest.test.mjs
?? packages/shared-types/src/commands.ts
?? packages/shared-types/src/events.ts
?? packages/shared-types/src/hardware.ts
?? packages/shared-types/src/heartbeat.ts
?? packages/shared-types/src/session.ts
?? packages/shared-types/src/tickets.ts
?? packages/shared-types/test/contracts.test.mjs
?? services/central-api/drizzle.central.config.ts
?? services/central-api/drizzle/
?? services/central-api/src/db/
?? services/central-api/src/repository.ts
?? services/central-api/src/routes.ts
?? services/central-api/test/central-api.test.mjs
?? services/local-backend/drizzle.local.config.ts
?? services/local-backend/drizzle/
?? services/local-backend/src/db/
?? services/local-backend/src/events.ts
?? services/local-backend/src/ids.ts
?? services/local-backend/src/session.ts
?? services/local-backend/src/skeleton.ts
?? services/local-backend/src/tickets.ts
ubuntu-hermes-01
2026-06-13T01:32:33+02:00
Linux ubuntu-hermes-01 6.8.0-124-generic #124-Ubuntu SMP PREEMPT_DYNAMIC Tue May 26 13:00:45 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux
```

### USB / token adapter evidence

```text
$ lsusb
Bus 001 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 002 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 003 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 004 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 005 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 006 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 007 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 008 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub

$ lsusb | grep -Ei '1a86:7523|CH340|CH341|QinHeng|USB Serial' || echo 'NO_CH340_USB_MATCH'
NO_CH340_USB_MATCH

$ dmesg --ctime | grep -Ei 'ch340|ch341|ttyUSB|1a86|7523|usb serial|qinheng|printer|pt80|icod' | tail -80
# no matching output

$ ls -l /dev/serial/by-id
ls: cannot access '/dev/serial/by-id': No such file or directory

$ ls -l /dev/ttyUSB* /dev/ttyACM*
ls: cannot access '/dev/ttyUSB*': No such file or directory
ls: cannot access '/dev/ttyACM*': No such file or directory
```

### sysfs cross-check

```text
$ for d in /sys/bus/usb/devices/*; do [ -r "$d/idVendor" ] || continue; ...; done | sort
usb1 vendor=1d6b product=0001 manufacturer=Linux 6.8.0-124-generic uhci_hcd product_name=UHCI Host Controller
usb2 vendor=1d6b product=0002 manufacturer=Linux 6.8.0-124-generic ehci_hcd product_name=EHCI Host Controller
usb3 vendor=1d6b product=0002 manufacturer=Linux 6.8.0-124-generic ehci_hcd product_name=EHCI Host Controller
usb4 vendor=1d6b product=0001 manufacturer=Linux 6.8.0-124-generic uhci_hcd product_name=UHCI Host Controller
usb5 vendor=1d6b product=0001 manufacturer=Linux 6.8.0-124-generic uhci_hcd product_name=UHCI Host Controller
usb6 vendor=1d6b product=0001 manufacturer=Linux 6.8.0-124-generic uhci_hcd product_name=UHCI Host Controller
usb7 vendor=1d6b product=0001 manufacturer=Linux 6.8.0-124-generic uhci_hcd product_name=UHCI Host Controller
usb8 vendor=1d6b product=0001 manufacturer=Linux 6.8.0-124-generic uhci_hcd product_name=UHCI Host Controller

$ sysfs match for 1a86:7523
NO_SYSFS_1a86_7523_MATCH

$ lsmod | grep -Ei 'ch341|usbserial|usblp' || echo 'NO_CH341_USBSERIAL_USBLP_MODULE_LOADED'
NO_CH341_USBSERIAL_USBLP_MODULE_LOADED
```

### Printer / CUPS evidence

```text
$ lpstat -t
lpstat: command not found

$ systemctl is-active cups
inactive

$ systemctl status cups --no-pager -l
Unit cups.service could not be found.

$ for c in lpstat lp lpadmin lpinfo cancel cupsd; do command -v "$c" || echo "$c=NOT_FOUND"; done
lpstat=NOT_FOUND
lp=NOT_FOUND
lpadmin=NOT_FOUND
lpinfo=NOT_FOUND
cancel=NOT_FOUND
cupsd=NOT_FOUND

$ test print decision
SKIPPED_TEST_PRINT: no lp/lpstat and/or no ICOD/PT80 CUPS queue detected
```

### Browser kiosk candidates

```text
$ for b in chromium chromium-browser google-chrome google-chrome-stable firefox; do command -v "$b" && "$b" --version; done
# no matching browser command produced output
```

## Missing evidence required before real adapter readiness claims

Capture these on the HQ/test kiosk with the real token adapter and printer connected:

1. `lsusb` showing CH340/CH341 USB serial adapter, expected baseline `1a86:7523`.
2. `dmesg --ctime` excerpt showing `ch341`/`ttyUSB*` attach and no driver errors.
3. `ls -l /dev/serial/by-id` showing a stable adapter path, ideally `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0` or the actual device-specific equivalent.
4. User/group permission evidence for the runtime user to open the serial device.
5. Raw token pulse/hex capture from the serial adapter and normalized token event mapping evidence.
6. CUPS installed and active: `systemctl status cups`, `lpstat -t`, and `lpstat -v` showing `ICOD-PT80KM` or `PT80KM` queue.
7. Real CUPS test print evidence from the target queue.
8. Paper profile evidence: paper width, printable area, cutter behavior if any, and QR readability photo/operator confirmation.
9. Browser kiosk boot evidence on the target device: browser package/version, configured flags, systemd restart behavior.
10. Offline token → interaction → ticket → print → reset flow evidence.
11. Tailscale access/monitoring/rollback evidence from the target kiosk.

## Gate decision

O0 physical evidence is not satisfied on `ubuntu-hermes-01`. Keep I10/Q4 and all real hardware readiness claims blocked until the above evidence is captured. Continue fake adapters/fake-flow implementation only.
