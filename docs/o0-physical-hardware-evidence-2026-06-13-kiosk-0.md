# O0 Physical Hardware Evidence — kiosk-0

Task: `t_01fb3d4f`
Host inspected: `kiosk_0@192.168.1.117` (`kiosk-0`)
Captured: 2026-06-13

## Gate result

O0 physical hardware availability is satisfied on the actual kiosk host: the target CH340/QinHeng token serial adapter and ICOD/PT80KM thermal printer are attached and visible to Linux Mint/CUPS.

This is not a full HQ pilot readiness or Q4 pass. The current deployed runtime is still using fake hardware adapters, no real token pulse/session evidence was captured, and no browser kiosk service/unit was present. I10 can use this evidence to implement real adapters; Q4 must still verify the full real token -> interaction -> ticket -> physical print -> reset/reboot flow.

## Identity / OS evidence

Command:

```sh
ssh kiosk_0@192.168.1.117 'hostnamectl; date -Is; uname -a; id; groups; cat /etc/os-release'
```

Key output:

```text
Static hostname: kiosk-0
Operating System: Linux Mint 22.3
Kernel: Linux 6.17.0-35-generic
date=2026-06-13T10:02:07-04:00
uid=1001(kiosk_0) gid=1001(kiosk_0) groups=1001(kiosk_0),4(adm),20(dialout),24(cdrom),27(sudo),30(dip),46(plugdev),100(users),105(lpadmin),125(sambashare),995(input)
NAME="Linux Mint"
VERSION="22.3 (Zena)"
```

## USB hardware evidence

Command:

```sh
lsusb
lsusb | grep -Ein '1a86:7523|1a86|7523|ch340|ch341|qinheng|USB.?Serial|serial'
```

Key output:

```text
Bus 002 Device 004: ID 1a86:7523 QinHeng Electronics CH340 serial converter
Bus 002 Device 008: ID 0483:7540 STMicroelectronics ICOD_Thermal_Printer
```

Sysfs scan:

```text
/sys/bus/usb/devices/2-3 vendor=1a86 product=7523 manufacturer= product_name=USB Serial serial=
/sys/bus/usb/devices/2-11 vendor=0483 product=7540 manufacturer=ICOD product_name=ICOD_Thermal_Printer serial=00000000000590bade
```

## Kernel / device node evidence

Command:

```sh
dmesg --ctime | grep -Ei 'ch340|ch341|ttyUSB|ttyACM|1a86|7523|usb serial|qinheng|printer|pt80|icod|usblp|cups' | tail -200
ls -l /dev/serial/by-id /dev/serial/by-path /dev/ttyUSB* /dev/ttyACM*
lsmod | grep -Ei 'ch341|usbserial|usblp|cdc_acm'
```

Key output:

```text
[Sat Jun 13 02:32:36 2026] usb 2-3: New USB device found, idVendor=1a86, idProduct=7523, bcdDevice= 2.64
[Sat Jun 13 02:32:36 2026] usb 2-3: Product: USB Serial
[Sat Jun 13 02:32:38 2026] usb 2-11: Product: ICOD_Thermal_Printer
[Sat Jun 13 02:32:38 2026] usb 2-11: Manufacturer: ICOD
[Sat Jun 13 02:32:45 2026] usblp 2-11:1.0: usblp1: USB Bidirectional printer dev 8 if 0 alt 0 proto 2 vid 0x0483 pid 0x7540
[Sat Jun 13 02:32:46 2026] usbcore: registered new interface driver ch341
[Sat Jun 13 02:32:46 2026] usbserial: USB Serial support registered for ch341-uart
[Sat Jun 13 02:32:46 2026] ch341 2-3:1.0: ch341-uart converter detected
[Sat Jun 13 02:32:46 2026] usb 2-3: ch341-uart converter now attached to ttyUSB0
```

Device nodes:

```text
/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0 -> ../../ttyUSB0
/dev/serial/by-path/pci-0000:00:14.0-usb-0:3:1.0-port0 -> ../../ttyUSB0
crw-rw---- 1 root dialout 188, 0 Jun 13 02:32 /dev/ttyUSB0
```

Kernel modules:

```text
ch341                  24576  0
usbserial              69632  1 ch341
usblp                  28672  0
```

Permission conclusion: `kiosk_0` is in `dialout`, and `/dev/ttyUSB0` is `root:dialout 660`, so the runtime user has serial device group access.

## Serial open test

Command:

```sh
python3 - <<'PY'
from pathlib import Path
import os, termios
p=Path('/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0')
print(f'path_exists={p.exists()} resolved={p.resolve() if p.exists() else None}')
fd=os.open(str(p), os.O_RDWR|os.O_NOCTTY|os.O_NONBLOCK)
print('open_ok=true')
termios.tcgetattr(fd)
print('termios_ok=true')
try:
    print('read_hex=' + os.read(fd, 64).hex())
except BlockingIOError:
    print('read_hex=NO_DATA_NONBLOCKING')
os.close(fd)
PY
```

Output:

```text
path_exists=True resolved=/dev/ttyUSB0
open_ok=true
termios_ok=true
read_hex=NO_DATA_NONBLOCKING
```

No raw token pulse/hex was captured because no physical token insertion event was triggered during this remote check.

## CUPS / printer evidence

Commands:

```sh
systemctl is-active cups
systemctl status cups --no-pager -l
lpstat -t
lpstat -v
lpstat -p
```

Key output:

```text
active
cups.service - CUPS Scheduler
Active: active (running) since Sat 2026-06-13 02:32:59 EDT
system default destination: ICOD-PT80KM
device for ICOD-PT80KM: usb://ICOD/PT80KM?serial=00000000000590bade
device for PT80KM: usb://ICOD/PT80KM?serial=00000000000590bade
ICOD-PT80KM accepting requests since Wed 03 Jun 2026 02:29:50 PM EDT
PT80KM accepting requests since Wed 03 Jun 2026 12:40:17 PM EDT
printer ICOD-PT80KM is idle.  enabled since Wed 03 Jun 2026 02:29:50 PM EDT
printer PT80KM is idle.  enabled since Wed 03 Jun 2026 12:40:17 PM EDT
```

## Physical test print command evidence

Command:

```sh
printf 'O0 physical evidence test print\nhost=%s\ndate=%s\nqueue=ICOD-PT80KM\n' "$(hostname)" "$(date -Is)" > /tmp/o0-physical-test-print.txt
lp -d ICOD-PT80KM -t O0-physical-evidence /tmp/o0-physical-test-print.txt
sleep 3
lpstat -W completed -o ICOD-PT80KM | tail -20
lpstat -o ICOD-PT80KM
```

Output:

```text
request id is ICOD-PT80KM-29 (1 file(s))
lp_exit=0
ICOD-PT80KM-29          kiosk_0           1024   Sat 13 Jun 2026 10:02:41 AM EDT
```

This proves CUPS accepted/completed a job to the ICOD/PT80KM queue. Remote SSH cannot visually confirm paper width, cutter behavior, printed QR readability, or physical paper output quality; Q4 must capture that with local/operator evidence.

## Browser/display/service/runtime evidence

Display/session command output:

```text
DISPLAY= WAYLAND_DISPLAY= XDG_SESSION_TYPE=tty XDG_CURRENT_DESKTOP=
SESSION  UID USER    SEAT  TTY   STATE  IDLE SINCE
     10 1001 kiosk_0 -     pts/1 active yes  7h ago
     65 1001 kiosk_0 -     -     active no   -
     c1 1000 yr      seat0 tty7  active no   -
```

Browser command availability:

```text
chromium=NOT_FOUND
chromium-browser=NOT_FOUND
google-chrome=NOT_FOUND
google-chrome-stable=NOT_FOUND
firefox=/usr/bin/firefox
xdg-open=/usr/bin/xdg-open
cage=NOT_FOUND
weston=NOT_FOUND
unclutter=NOT_FOUND
```

System/user service evidence:

```text
retail-kiosk.target: Unit could not be found.
retail-kiosk-app.service: Unit could not be found.
retail-kiosk-browser.service: Unit could not be found.
kiosk-agent.service: Unit could not be found.
tailscaled.service: Unit could not be found.
```

User fallback services:

```text
retail-kiosk-agent.service         loaded active running Retail Kiosk Agent - user fallback
retail-kiosk-local-backend.service loaded active running Retail Kiosk Local Backend - user fallback
```

Detailed user service output:

```text
retail-kiosk-agent.service - Retail Kiosk Agent - user fallback
Active: active (running) since Sat 2026-06-13 04:28:24 EDT
Exec: /home/kiosk_0/.local/bin/node services/kiosk-agent/dist/index.js

retail-kiosk-local-backend.service - Retail Kiosk Local Backend - user fallback
Active: active (running) since Sat 2026-06-13 09:15:32 EDT
Exec: /home/kiosk_0/.local/bin/node services/local-backend/dist/cli.js
```

Port/runtime health:

```text
LISTEN 0      511          0.0.0.0:8787      0.0.0.0:*    users:(("node",pid=7938,fd=24))
GET / -> HTTP/1.1 404 Not Found {"message":"Route GET:/ not found","error":"Not Found","statusCode":404}
GET /health -> HTTP/1.1 200 OK
{"status":"ok","runtime":"local-backend","fake_hardware":true,"adapters":{"token":{"adapter":"FakeTokenAdapter","status":"online","fake":true},"printer":{"adapter":"FakePrinterAdapter","status":"online","fake":true}}}
```

Runtime logs:

```text
local-backend listening on 0.0.0.0:8787
kiosk-agent cycle complete: commands_seen=0 results_reported=0
```

Release/current path:

```text
/home/kiosk_0/retail-kiosk/current -> /home/kiosk_0/retail-kiosk/releases/kiosk0-20260613T073819Z
```

Tailscale:

```text
TAILSCALE_NOT_FOUND
```

## Missing evidence before real readiness / Q4

1. Real token insertion/pulse capture from `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`, including raw bytes/timing and normalized token event mapping.
2. Runtime configured to use real token/printer adapters; current `/health` reports `fake_hardware: true` and `FakeTokenAdapter`/`FakePrinterAdapter`.
3. Browser kiosk unit/service or equivalent display-session launch evidence; no Chromium/Chrome/Cage/Weston was installed and no `retail-kiosk-browser.service` was present.
4. Full physical flow evidence: real token -> session/interaction -> ticket -> physical CUPS print -> reset.
5. Visual/local evidence for paper width, printable area, cutter behavior, QR readability, and actual paper output quality.
6. Reboot recovery/systemd target evidence for the complete kiosk stack.
7. Tailscale/monitoring/rollback evidence if those remain launch requirements; `tailscale` was not installed on this host.

## O0 conclusion

The earlier `ubuntu-hermes-01` negative hardware result is superseded for this task by the actual kiosk host evidence above. Physical CH340 serial and ICOD/PT80KM printer hardware are attached and usable at the OS/CUPS level on `kiosk-0`. This satisfies the O0 physical availability spike for proceeding to I10 real adapter implementation, while Q4/full hardware readiness remains gated on the missing runtime/browser/full-flow evidence listed above.
