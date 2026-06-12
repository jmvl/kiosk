# D2 Hardware Baseline and Unknowns

> Task: `t_14147a7e` — Confirm kiosk hardware baseline and unknowns.  
> Scope: document-confirmed baseline only. No physical kiosk, coin acceptor, or printer was tested in this run.

## Evidence inspected

- `docs/kiosk-operating-layer-prd.md`: v1 scope includes fake token/printer adapters, CH340 USB serial token adapter abstraction, and CUPS/ESC/POS thermal printer adapter abstraction.
- `docs/kiosk-orchestrator-plan.md`: D2 acceptance is a hardware facts table and blockers; I9/I10 depend on this baseline.
- `docs/conversation-map-mattermost-kiosk-2026-06-07.md`: contains JM-provided target OS, network, serial coin, CUPS printer, and pilot decisions.
- `docs/it-architecture-components-brainstorm-2026-06-08.md`: restates HAL requirements and HQ acceptance checklist.
- `docs/platform-foundation.md`: confirms first milestone should remain simulated before real hardware integration.

## Hardware baseline table

| Area | Baseline for v1 / HQ pilot | Evidence status | Implementation implication |
|---|---|---|---|
| OS | Linux Mint 22.3 "Zena" / Ubuntu LTS family; recorded target host `yr-N-A`, kernel `6.14.0-37-generic`. | Document-confirmed from prior JM-provided baseline; not live-tested in this run. | Use Ubuntu/Mint-compatible systemd, CUPS, udev, Docker Compose, Chromium packaging assumptions. Do not use distro-specific APIs beyond Debian/Ubuntu family basics. |
| Kiosk app path | `/home/yr/kiosk`; launcher `/home/yr/kiosk/scripts/start-ptit-lion-kiosk.sh`; local URL `http://127.0.0.1:8787`. | Document-confirmed; no SSH or filesystem check against target device in this run. | I9 runbook should install/operate under the `yr` user unless JM changes the target user/path. |
| Required OS groups | `dialout`, `lpadmin`. | Document-confirmed. | Kiosk service user needs serial access (`dialout`) and printer administration/queue access (`lpadmin` or narrower CUPS policy if later hardened). |
| Token / coin acceptor | USB serial coin acceptor via CH340 adapter. USB ID `1a86:7523` QinHeng Electronics CH340 serial converter. Driver `ch341`. | Document-confirmed first physical adapter. No live `lsusb`, `dmesg`, or serial read performed in this run. | Implement a serial adapter against Node serialport or equivalent; normalize serial receive bytes into token events; include health/status and explicit disconnect errors. |
| Serial device path | Runtime path `/dev/ttyUSB0`; stable preferred path `/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0`. | Document-confirmed. | Prefer configurable stable by-id path. Fall back to `/dev/ttyUSB0` only for diagnostics/dev. Add udev/runbook notes to verify by-id symlink and permissions. |
| Token event shape | Expected event: `coin detected source=serial_rx:<hex>`. | Document-confirmed; event byte protocol still unknown. | Fake adapter can emit the same normalized event shape now. Real adapter must log raw hex safely for calibration until protocol mapping is confirmed. |
| Printer | USB thermal printer, model/path `ICOD/PT80KM`. Primary CUPS queue `ICOD-PT80KM`; alternate `PT80KM`. | Document-confirmed first printer path. No live CUPS query or test print in this run. | Implement CUPS-backed print adapter first. Queue name must be configurable with default `ICOD-PT80KM` and fallback `PT80KM` only if detected/configured. |
| Printer USB / driver | CUPS URI `usb://ICOD/PT80KM?serial=00000000000590bade`; USB ID `0483:7540` STMicroelectronics `ICOD_Thermal_Printer`; driver `usblp`. | Document-confirmed. | I9/I10 runbooks should verify `lsusb`, `lpstat -v`, `lpstat -p`, CUPS queue enabled, and `usblp` availability before claiming hardware ready. |
| Print route | Working print path is CUPS image print through `ICOD-PT80KM`. HTTP print API at `http://192.168.1.10:3000` is unavailable. | Document-confirmed. | Do not depend on the unavailable HTTP print API. Local runtime should submit rendered ticket/image/PDF to CUPS and record job id/result/failure reason. |
| ESC/POS | PRD names CUPS/ESC/POS thermal printer abstraction, but current concrete evidence says CUPS image print is the working route. | Partially confirmed: CUPS path confirmed; direct ESC/POS command mode not confirmed. | Treat ESC/POS direct/raw mode as optional later spike. v1 real adapter should use CUPS unless HQ testing proves raw ESC/POS is required. |
| Paper width | Unknown. PT80KM suggests likely 80mm class, but paper width is not explicitly confirmed in inspected docs. | Unknown requiring JM/device confirmation. | Ticket renderer must make paper width configurable; do not hardcode beyond a safe default profile. Need physical measurement or printer spec before final ticket layout. |
| Browser / kiosk mode | Fullscreen browser shell; PRD/task assumptions mention Chromium kiosk mode. | Architecture-confirmed, but exact browser package/channel not confirmed. | I9 should create a configurable Chromium/Chrome launch service using `--kiosk`/fullscreen flags, health restart, local URL, and no customer-visible debug controls. |
| Service supervision | systemd supervision for kiosk browser/agent and Docker Compose lifecycle; Docker Compose where practical. | Document-confirmed. | Implement systemd units/runbooks for local backend, kiosk agent, browser launcher, and compose lifecycle; include rollback/current/previous version pointers. |
| Network / remote access | Wi-Fi + Ethernet required; LTE card to be checked; Tailscale mandatory; Uptime Kuma recommended; screenshot/snapshot monitoring approved. | Document-confirmed. | HQ checklist must verify network interfaces, Tailscale auth/ACL, remote emergency access, and monitoring separately from app readiness. |

## Unknowns requiring JM or physical-device confirmation

1. Actual physical access path: whether `yr-N-A` at `192.168.1.117` is reachable from the automation environment and whether SSH credentials/keys are available for ops verification.
2. Coin/token acceptor protocol: baud rate, framing, whether one coin emits one byte/pulse or a structured packet, debounce rules, accepted token denominations, and calibration procedure.
3. Whether the CH340 by-id symlink is stable across all 10 pilot kiosks or only the first adapter; if serial numbers are duplicated, a custom udev rule by USB port/path may be needed.
4. Printer paper width and printable pixel width: likely PT80 class, but the docs do not explicitly confirm 80mm paper, margins, cutter behavior, or QR/barcode support.
5. CUPS driver/filter details: exact PPD/driver used, whether print jobs should be PNG/PDF/raw, and whether CUPS reports reliable job completion for this printer.
6. Whether direct ESC/POS/raw printing is required for speed/cutter/cash-drawer-style commands, or whether CUPS image printing is sufficient for v1.
7. Exact browser package: Chromium vs Google Chrome, snap/deb/flatpak availability on Linux Mint 22.3, GPU flags, touch-screen calibration, display rotation, and screensaver/power management settings.
8. Kiosk physical peripherals beyond coin/printer: touch panel model, display resolution/orientation, audio, cabinet buttons, door/maintenance switch, UPS/power behavior.
9. LTE card existence/operator/SIM requirements; currently only a spike/check item.
10. Final production user/path convention: docs use `yr` and `/home/yr/kiosk`, but implementation should confirm whether this holds for all kiosks.

## What can be implemented with fake adapters before hardware arrives

- Local runtime HAL interfaces for token and printer adapters.
- Fake token adapter that emits normalized token events using the same event/log shape expected from serial input.
- Fake printer adapter that creates print requests/results and failure modes without touching CUPS.
- Session FSM: idle → token received → game/session active → ticket generated → print requested → print result → reset.
- SQLite schema for sessions, token events, print jobs/results, tickets, append-only event log, sync outbox.
- REST/WebSocket local API for kiosk player state, diagnostics, test token, test print, and maintenance mode.
- Kiosk player fake paid flow and campaign/package loading against local runtime.
- Admin/test endpoints for adapter health and evidence capture.
- Config contract for real hardware later: serial device path, baud rate, CUPS queue, paper profile, adapter mode (`fake`, `serial-ch340`, `cups`).
- Failure simulation: serial disconnected, malformed token event, printer offline, CUPS job rejected, print timeout, duplicate print attempt.

Recommended sequencing remains: build and QA fake flow first, then spike CH340 serial input and CUPS `ICOD-PT80KM` printing on physical HQ hardware.

## Physical HQ checklist prerequisites

Before claiming real hardware readiness, HQ/operator evidence should include:

1. OS/device identity: `hostnamectl`, `uname -a`, logged-in service user, app path, and local URL.
2. User permissions: service user is in `dialout` and has required CUPS permissions (`lpadmin` or approved narrower policy); user can access serial device without sudo.
3. Serial detection: `lsusb` shows `1a86:7523`; `dmesg` shows `ch341` attach; `/dev/serial/by-id/...` exists; stable path survives unplug/replug and reboot.
4. Serial read test: known token insertion produces captured raw hex, timestamp, and normalized event; disconnect/reconnect behavior is logged.
5. Printer detection: `lsusb` shows `0483:7540`; CUPS has queue `ICOD-PT80KM` or approved configured queue; `lpstat -p -v` shows enabled/accepting state.
6. Print test: CUPS test print and application ticket print both complete; failed printer/offline state records explicit failure rather than hanging.
7. Paper/profile: confirm paper width, printable area, cutter behavior, QR/barcode readability, and ticket template dimensions.
8. Browser kiosk mode: device boots into fullscreen local app without manual browser setup; no address bar/debug controls visible to customers; reset/timeout returns to attract screen.
9. Service supervision: backend, kiosk agent, browser launcher, and any Docker Compose units restart on failure and after reboot; logs are in documented paths.
10. Offline operation: with internet disabled, cached package still supports token → play → ticket print → event log; sync resumes later.
11. Remote ops: Tailscale connected with approved ACLs; admin can see heartbeat/version; emergency restart/test-print command lifecycle is logged.
12. Rollback: current/previous version pointers tested; previous known-good app/package can be restored after a failed rollout.
13. Monitoring/evidence: Uptime Kuma or equivalent receives health checks; approved screenshot/snapshot evidence works without exposing unnecessary customer data.

## D2 decision result

D2 is sufficient to unblock spec addendum work and fake-adapter implementation. It does not prove physical hardware readiness. Real hardware adapter implementation should remain gated on an HQ spike/test pass that captures the physical evidence above.
