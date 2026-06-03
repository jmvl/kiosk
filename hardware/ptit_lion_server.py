#!/usr/bin/env python3
"""Local server for the P'tit Lion kiosk fortune demo."""

from __future__ import annotations

import argparse
import errno
import fcntl
import json
import mimetypes
import os
import queue
import random
import select
import signal
import socketserver
import struct
import subprocess
import sys
import termios
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None
    ImageDraw = None
    ImageFont = None


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_COIN_SERIAL = "/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0"
DEFAULT_SCANNER_PATH = "/dev/input/by-id/usb-usbd_USB_HID_KEYBOARD_000000-event-kbd"
DEFAULT_PRINTER_API = "http://192.168.1.10:3000"
DEFAULT_CUPS_PRINTER = "ICOD-PT80KM"
DEFAULT_LOGO_PATH = ROOT / "public" / "assets" / "delhaize-bicolor-logo.png"
TICKET_WIDTH = 576
INPUT_EVENT_STRUCT = struct.Struct("llHHI")
INPUT_EVENT_SIZE = INPUT_EVENT_STRUCT.size
EV_KEY = 0x01
KEY_PRESS = 1
KEY_RELEASE = 0
KEY_LEFTSHIFT = 42
KEY_RIGHTSHIFT = 54
KEY_ENTER = 28
KEY_KPENTER = 96
KEY_BACKSPACE = 14
KEY_SPACE = 57
MEMBER_SUFFIX = "954"
MEMBER_NAME = "Jean-Michel"

KEYMAP = {
    2: ("1", "!"),
    3: ("2", "@"),
    4: ("3", "#"),
    5: ("4", "$"),
    6: ("5", "%"),
    7: ("6", "^"),
    8: ("7", "&"),
    9: ("8", "*"),
    10: ("9", "("),
    11: ("0", ")"),
    12: ("-", "_"),
    13: ("=", "+"),
    16: ("q", "Q"),
    17: ("w", "W"),
    18: ("e", "E"),
    19: ("r", "R"),
    20: ("t", "T"),
    21: ("y", "Y"),
    22: ("u", "U"),
    23: ("i", "I"),
    24: ("o", "O"),
    25: ("p", "P"),
    26: ("[", "{"),
    27: ("]", "}"),
    30: ("a", "A"),
    31: ("s", "S"),
    32: ("d", "D"),
    33: ("f", "F"),
    34: ("g", "G"),
    35: ("h", "H"),
    36: ("j", "J"),
    37: ("k", "K"),
    38: ("l", "L"),
    39: (";", ":"),
    40: ("'", '"'),
    41: ("`", "~"),
    43: ("\\", "|"),
    44: ("z", "Z"),
    45: ("x", "X"),
    46: ("c", "C"),
    47: ("v", "V"),
    48: ("b", "B"),
    49: ("n", "N"),
    50: ("m", "M"),
    51: (",", "<"),
    52: (".", ">"),
    53: ("/", "?"),
    KEY_SPACE: (" ", " "),
}

JOKES = [
    "Why did the lion open a kiosk? For the mane income.",
    "A coin went into the jungle. It came out with exact pride.",
    "The scanner asked the lion for ID. The lion said: roar code.",
    "Today your fortune is crisp paper and questionable humor.",
    "The wheel says: you win one premium dad joke.",
    "A tiny lion walks into a shop. Everyone says: P'tit cash?",
    "Your receipt is legally binding in the kingdom of nonsense.",
    "The printer is not laughing. It is thermally amused.",
]

clients: set[queue.Queue[tuple[str, dict]]] = set()
clients_lock = threading.Lock()
running = True

TIOCMGET = getattr(termios, "TIOCMGET", 0x5415)
MODEM_BITS = {
    getattr(termios, "TIOCM_CTS", 0x020): "CTS",
    getattr(termios, "TIOCM_DSR", 0x100): "DSR",
    getattr(termios, "TIOCM_RI", 0x080): "RI",
    getattr(termios, "TIOCM_CD", 0x040): "DCD",
}


def emit(event: str, payload: dict) -> None:
    with clients_lock:
        targets = list(clients)
    for target in targets:
        try:
            target.put_nowait((event, payload))
        except queue.Full:
            pass


def format_ticket(joke: str, scan: str = "") -> str:
    text = "\n".join(
        [
            "=== P'TIT LION FORTUNE ===",
            "",
            joke,
            "",
            f"SCAN: {scan}" if scan else "SCAN: -",
            time.strftime("%Y-%m-%d %H:%M:%S"),
            "",
        ]
    )
    return text


def print_joke_http(printer_api: str, text: str) -> bool:
    if not printer_api:
        return False

    body = json.dumps({"text": text}).encode("utf-8")
    request = urllib.request.Request(
        f"{printer_api.rstrip('/')}/api/print/text",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            ok = 200 <= response.status < 300
            print(f"printer response status={response.status} ok={ok}", flush=True)
            return ok
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"printer request failed: {exc}", flush=True)
        return False


def print_joke_cups(cups_printer: str, text: str) -> bool:
    if not cups_printer:
        return False

    try:
        result = subprocess.run(
            ["lp", "-d", cups_printer, "-t", "P'tit Lion Fortune"],
            input=text.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=8,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"cups print failed: {exc}", flush=True)
        return False

    ok = result.returncode == 0
    stdout = result.stdout.decode("utf-8", errors="replace").strip()
    stderr = result.stderr.decode("utf-8", errors="replace").strip()
    print(f"cups print printer={cups_printer} ok={ok} stdout={stdout!r} stderr={stderr!r}", flush=True)
    return ok


def load_font(size: int, bold: bool = False):
    if ImageFont is None:
        return None
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def wrap_pixels(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] > max_width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def build_ticket_image(joke: str, scan: str = "", logo_path: Path = DEFAULT_LOGO_PATH) -> Path | None:
    if Image is None or ImageDraw is None:
        return None

    title_font = load_font(32, bold=True)
    body_font = load_font(27, bold=False)
    small_font = load_font(19, bold=False)
    red = (237, 28, 49)
    black = (12, 12, 12)
    white = (255, 255, 255)

    logo = Image.open(logo_path).convert("RGBA")
    logo.thumbnail((360, 200), Image.Resampling.LANCZOS)

    scratch = Image.new("RGB", (TICKET_WIDTH, 1200), white)
    draw = ImageDraw.Draw(scratch)
    joke_lines = wrap_pixels(draw, joke, body_font, TICKET_WIDTH - 72)
    meta = f"SCAN: {scan}" if scan else time.strftime("%Y-%m-%d %H:%M:%S")
    height = 34 + logo.height + 34 + 42 + 18 + (len(joke_lines) * 38) + 34 + 26 + 56
    image = Image.new("RGB", (TICKET_WIDTH, height), white)
    draw = ImageDraw.Draw(image)

    y = 26
    image.paste(logo, ((TICKET_WIDTH - logo.width) // 2, y), logo)
    y += logo.height + 26
    draw.text((TICKET_WIDTH // 2, y), "P'TIT LION FORTUNE", fill=red, font=title_font, anchor="ma")
    y += 52
    draw.line((42, y, TICKET_WIDTH - 42, y), fill=black, width=3)
    y += 26
    for line in joke_lines:
        draw.text((38, y), line, fill=black, font=body_font)
        y += 38
    y += 12
    draw.line((42, y, TICKET_WIDTH - 42, y), fill=black, width=2)
    y += 18
    draw.text((TICKET_WIDTH // 2, y), meta, fill=black, font=small_font, anchor="ma")

    output = Path("/tmp/ptit-lion-fortune-ticket.png")
    image.save(output)
    return output


def print_joke_cups_image(cups_printer: str, joke: str, scan: str = "") -> bool:
    if not cups_printer:
        return False
    ticket_path = build_ticket_image(joke, scan)
    if ticket_path is None:
        return False
    try:
        result = subprocess.run(
            [
                "lp",
                "-d",
                cups_printer,
                "-t",
                "P'tit Lion Fortune",
                "-o",
                "PageSize=X80mmY210mm",
                "-o",
                "fit-to-page",
                str(ticket_path),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"cups image print failed: {exc}", flush=True)
        return False
    ok = result.returncode == 0
    stdout = result.stdout.decode("utf-8", errors="replace").strip()
    stderr = result.stderr.decode("utf-8", errors="replace").strip()
    print(f"cups image print printer={cups_printer} ok={ok} stdout={stdout!r} stderr={stderr!r}", flush=True)
    return ok


def print_joke(printer_api: str, cups_printer: str, joke: str, scan: str = "") -> bool:
    text = format_ticket(joke, scan)
    if print_joke_http(printer_api, text):
        return True
    if print_joke_cups_image(cups_printer, joke, scan):
        return True
    return print_joke_cups(cups_printer, text)


def handle_coin(
    printer_api: str,
    cups_printer: str,
    source: str = "unknown",
    scan: str = "",
    free: bool = False,
    member_name: str = "",
) -> None:
    joke = random.choice(JOKES)
    kind = "member free spin" if free else "coin"
    print(f"{kind} detected source={source} scan={scan!r} joke={joke!r}", flush=True)
    emit("coin", {"joke": joke, "source": source, "scan": scan, "free": free, "memberName": member_name})

    def delayed_print() -> None:
        ok = print_joke(printer_api, cups_printer, joke, scan)
        emit("printer", {"ok": ok})

    threading.Timer(3.8, delayed_print).start()


def handle_scan(payload: str, printer_api: str, cups_printer: str, source: str) -> None:
    print(f"scan detected source={source} payload={payload!r}", flush=True)
    emit("scan", {"payload": payload, "source": source})
    if payload.endswith(MEMBER_SUFFIX):
        message = (
            f"Hi {MEMBER_NAME}, how are you? Since you're a member, "
            "you don't need to put a coin."
        )
        print(f"member scan accepted payload={payload!r} name={MEMBER_NAME}", flush=True)
        emit("member", {"payload": payload, "name": MEMBER_NAME, "message": message})
        handle_coin(
            printer_api,
            cups_printer,
            source=f"member_scan:{payload}",
            scan=payload,
            free=True,
            member_name=MEMBER_NAME,
        )


def modem_state(fd: int) -> int | None:
    try:
        data = struct.pack("I", 0)
        return struct.unpack("I", fcntl.ioctl(fd, TIOCMGET, data))[0]
    except OSError:
        return None


def format_modem_bits(bits: int | None) -> str:
    if bits is None:
        return "unavailable"
    active = [name for bit, name in MODEM_BITS.items() if bits & bit]
    return ",".join(active) if active else "none"


class CoinSerialMonitor(threading.Thread):
    def __init__(self, path: str, printer_api: str, cups_printer: str, baud: int = 9600) -> None:
        super().__init__(daemon=True)
        self.path = path
        self.printer_api = printer_api
        self.cups_printer = cups_printer
        self.baud = baud

    def run(self) -> None:
        try:
            fd = os.open(self.path, os.O_RDONLY | os.O_NONBLOCK)
        except OSError as exc:
            print(f"coin serial unavailable: {self.path}: {exc}", file=sys.stderr)
            return

        try:
            configure_serial(fd, self.baud)
            warmup_until = time.monotonic() + 0.8
            last_coin = 0.0
            last_modem = modem_state(fd)
            print(
                f"coin serial ready path={self.path} baud={self.baud} modem={format_modem_bits(last_modem)}",
                flush=True,
            )
            while running:
                readable, _, _ = select.select([fd], [], [], 0.005)
                now = time.monotonic()
                if readable:
                    data = os.read(fd, 1024)
                    if data:
                        if now < warmup_until:
                            print(f"coin serial warmup bytes={data.hex()}", flush=True)
                        elif now - last_coin >= 0.35:
                            last_coin = now
                            handle_coin(self.printer_api, self.cups_printer, source=f"serial_rx:{data.hex()}")

                current_modem = modem_state(fd)
                if current_modem is not None and last_modem is not None and current_modem != last_modem:
                    if now < warmup_until:
                        print(
                            "coin serial warmup modem "
                            f"before={format_modem_bits(last_modem)} after={format_modem_bits(current_modem)}",
                            flush=True,
                        )
                    elif now - last_coin >= 0.35:
                        last_coin = now
                        handle_coin(
                            self.printer_api,
                            self.cups_printer,
                            source=(
                                "serial_modem:"
                                f"{format_modem_bits(last_modem)}->{format_modem_bits(current_modem)}"
                            ),
                        )
                last_modem = current_modem
        finally:
            os.close(fd)


class ScannerMonitor(threading.Thread):
    def __init__(self, path: str, printer_api: str, cups_printer: str) -> None:
        super().__init__(daemon=True)
        self.path = path
        self.printer_api = printer_api
        self.cups_printer = cups_printer

    def run(self) -> None:
        try:
            fd = os.open(self.path, os.O_RDONLY | os.O_NONBLOCK)
        except PermissionError as exc:
            print(
                f"scanner permission denied path={self.path} error={exc}; "
                "add kiosk user to input group or set a udev rule",
                file=sys.stderr,
                flush=True,
            )
            return
        except OSError as exc:
            print(f"scanner unavailable path={self.path} error={exc}", file=sys.stderr, flush=True)
            return

        buffer: list[str] = []
        shift_down = False
        print(f"scanner ready path={self.path}", flush=True)
        try:
            while running:
                readable, _, _ = select.select([fd], [], [], 0.1)
                if not readable:
                    continue
                try:
                    data = os.read(fd, INPUT_EVENT_SIZE)
                except OSError as exc:
                    if exc.errno in (errno.EINTR, errno.EAGAIN):
                        continue
                    if exc.errno == errno.ENODEV:
                        print(f"scanner disconnected path={self.path}", flush=True)
                        return
                    print(f"scanner read failed path={self.path} error={exc}", file=sys.stderr, flush=True)
                    return

                if len(data) != INPUT_EVENT_SIZE:
                    continue

                _sec, _usec, event_type, code, value = INPUT_EVENT_STRUCT.unpack(data)
                if event_type != EV_KEY:
                    continue
                if code in (KEY_LEFTSHIFT, KEY_RIGHTSHIFT):
                    shift_down = value != KEY_RELEASE
                    continue
                if value != KEY_PRESS:
                    continue
                if code in (KEY_ENTER, KEY_KPENTER):
                    payload = "".join(buffer)
                    buffer.clear()
                    if payload:
                        handle_scan(payload, self.printer_api, self.cups_printer, self.path)
                    continue
                if code == KEY_BACKSPACE:
                    if buffer:
                        buffer.pop()
                    continue

                mapped = KEYMAP.get(code)
                if mapped:
                    buffer.append(mapped[1] if shift_down else mapped[0])
                else:
                    print(f"scanner unknown key code={code} value={value}", flush=True)
        finally:
            os.close(fd)


def configure_serial(fd: int, baud: int) -> None:
    baud_map = {
        9600: termios.B9600,
        19200: termios.B19200,
        38400: termios.B38400,
        57600: termios.B57600,
        115200: termios.B115200,
    }
    speed = baud_map.get(baud, termios.B9600)
    attrs = termios.tcgetattr(fd)
    attrs[0] = 0
    attrs[1] = 0
    attrs[2] = termios.CLOCAL | termios.CREAD | termios.CS8
    attrs[3] = 0
    attrs[4] = speed
    attrs[5] = speed
    attrs[6][termios.VMIN] = 0
    attrs[6][termios.VTIME] = 0
    termios.tcsetattr(fd, termios.TCSANOW, attrs)


class Handler(BaseHTTPRequestHandler):
    def handle(self) -> None:
        try:
            super().handle()
        except ConnectionResetError:
            pass

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.client_address[0]} - {fmt % args}")

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/events":
            self.handle_events()
            return
        if parsed.path == "/api/simulate-coin":
            handle_coin(self.server.printer_api, self.server.cups_printer)  # type: ignore[attr-defined]
            self.write_json({"ok": True})
            return
        if parsed.path == "/api/simulate-scan":
            params = urllib.parse.parse_qs(parsed.query)
            payload = params.get("payload", ["2504711954"])[0]
            handle_scan(
                payload,
                self.server.printer_api,  # type: ignore[attr-defined]
                self.server.cups_printer,  # type: ignore[attr-defined]
                "api",
            )
            self.write_json({"ok": True, "payload": payload})
            return
        self.serve_static(parsed.path)

    def serve_static(self, path: str) -> None:
        if path == "/":
            path = "/index.html"
        static_dir = self.server.static_dir  # type: ignore[attr-defined]
        target = (static_dir / path.lstrip("/")).resolve()
        if not str(target).startswith(str(static_dir)) or not target.exists() or target.is_dir():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def write_json(self, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_events(self) -> None:
        events: queue.Queue[tuple[str, dict]] = queue.Queue(maxsize=64)
        with clients_lock:
            clients.add(events)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            while running:
                try:
                    event, payload = events.get(timeout=15)
                    data = json.dumps(payload)
                    self.wfile.write(f"event: {event}\ndata: {data}\n\n".encode("utf-8"))
                except queue.Empty:
                    self.wfile.write(b": keepalive\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with clients_lock:
                clients.discard(events)


class Server(ThreadingHTTPServer):
    printer_api: str
    cups_printer: str
    static_dir: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the P'tit Lion kiosk fortune demo server.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--coin-serial", default=DEFAULT_COIN_SERIAL)
    parser.add_argument("--scanner-device", default=DEFAULT_SCANNER_PATH)
    parser.add_argument("--printer-api", default=os.environ.get("PRINTER_API_URL", DEFAULT_PRINTER_API))
    parser.add_argument("--cups-printer", default=os.environ.get("CUPS_PRINTER", DEFAULT_CUPS_PRINTER))
    parser.add_argument("--static-dir", default=str(ROOT / "dist"))
    parser.add_argument("--no-coin-monitor", action="store_true")
    parser.add_argument("--no-scanner-monitor", action="store_true")
    return parser.parse_args()


def stop(_signum: int, _frame: object) -> None:
    global running
    running = False


def main() -> int:
    args = parse_args()
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    server = Server((args.host, args.port), Handler)
    server.printer_api = args.printer_api
    server.cups_printer = args.cups_printer
    server.static_dir = Path(args.static_dir).expanduser().resolve()

    if not args.no_coin_monitor:
        CoinSerialMonitor(args.coin_serial, args.printer_api, args.cups_printer).start()
    if not args.no_scanner_monitor:
        ScannerMonitor(args.scanner_device, args.printer_api, args.cups_printer).start()

    print(f"P'tit Lion Fortune running at http://{args.host}:{args.port}")
    print(f"Coin serial: {args.coin_serial}")
    print(f"Scanner device: {args.scanner_device}")
    print(f"Printer API: {args.printer_api}")
    print(f"CUPS printer fallback: {args.cups_printer}")
    print(f"Static dir: {server.static_dir}")
    while running:
        server.handle_request()
    server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
