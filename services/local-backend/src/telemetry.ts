import { execFile } from 'node:child_process';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { networkInterfaces, hostname, uptime as osUptime } from 'node:os';
import type { LocalBackendConfig } from './server.js';

const execFileAsync = promisify(execFile);

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>;

export interface TelemetryOptions {
  env?: NodeJS.ProcessEnv;
  runner?: CommandRunner;
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
}

export interface AdminTelemetry {
  generated_at: string;
  host: {
    hostname: string;
    node_version: string;
    node_versions: NodeJS.ProcessVersions;
    process_uptime_seconds: number;
    os_uptime_seconds: number;
  };
  network: {
    lan_ips: Array<{ interface: string; address: string; family: string; internal: boolean }>;
    active_interface: string | null;
    gateway: string | null;
    dns: { status: 'ok' | 'error' | 'unconfigured'; target: string | null; addresses: string[]; error: string | null };
    central_api: { status: 'ok' | 'error' | 'unconfigured'; url: string | null; http_status: number | null; error: string | null };
    wifi: { active: boolean; interface: string | null; ssid: string | null; signal_dbm: number | null; link_speed_mbit: number | null; raw: string | null; error: string | null };
    ethernet: Array<{ interface: string; operstate: string | null; carrier: boolean | null; speed_mbit: number | null }>;
  };
  system: {
    disk: { path: string; filesystem: string | null; size_kb: number | null; used_kb: number | null; available_kb: number | null; used_percent: number | null; error: string | null };
    systemd_user_service: { name: string; active: string | null; sub: string | null; loaded: string | null; error: string | null };
    port_bind: { port: number; host: string; listeners: string[]; raw: string | null; error: string | null };
  };
  hardware: {
    serial_ch340: { configured_path: string; detected_paths: string[]; exists: boolean; error: string | null };
    cups: {
      default_printer: string | null;
      printers: Array<{ name: string; status: string; paper_status: 'ok' | 'empty' | 'low' | 'unknown'; paper_hint: string | null }>;
      queue: string[];
      error: string | null;
    };
    peripherals: Array<{
      id: string;
      label: string;
      kind: 'token_input' | 'printer' | 'printer_paper';
      configured: 'required' | 'optional' | 'not_installed';
      present: boolean;
      operating: boolean | null;
      status: 'ok' | 'warning' | 'error' | 'not_applicable';
      detail: string;
    }>;
  };
}

export const defaultCommandRunner: CommandRunner = async (command, args) => {
  try {
    const result = await execFileAsync(command, [...args], { timeout: 2_000, windowsHide: true });
    return { code: 0, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? '') };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
    return { code: typeof err.code === 'number' ? err.code : 1, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? err.message ?? '') };
  }
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function centralApiUrl(env: NodeJS.ProcessEnv): string | null {
  return trimOrNull(env.CENTRAL_API_BASE_URL ?? env.CENTRAL_API_URL ?? env.KIOSK_CENTRAL_API_URL);
}


function peripheralConfig(value: string | undefined, fallback: 'required' | 'optional' | 'not_installed'): 'required' | 'optional' | 'not_installed' {
  const normalized = value?.trim().toLowerCase().replace(/[- ]/g, '_');
  if (normalized === 'required' || normalized === 'yes' || normalized === 'true' || normalized === 'installed') return 'required';
  if (normalized === 'optional') return 'optional';
  if (normalized === 'not_installed' || normalized === 'none' || normalized === 'no' || normalized === 'false' || normalized === 'absent') return 'not_installed';
  return fallback;
}

function parsePrinterPaperStatus(statusText: string): { status: 'ok' | 'empty' | 'low' | 'unknown'; hint: string | null } {
  const normalized = statusText.toLowerCase();
  if (/media-empty|paper[-_ ]?out|out of paper|media-needed|load paper|paper empty/.test(normalized)) {
    return { status: 'empty', hint: statusText };
  }
  if (/paper[-_ ]?low|low paper|media-low/.test(normalized)) {
    return { status: 'low', hint: statusText };
  }
  if (/idle|enabled|accepting|processing/.test(normalized) && !/disabled|stopped|error|offline/.test(normalized)) {
    return { status: 'ok', hint: statusText };
  }
  return { status: 'unknown', hint: statusText || null };
}

export function parseDefaultRoute(output: string): { active_interface: string | null; gateway: string | null } {
  const line = output.split('\n').find((candidate) => candidate.trim().startsWith('default ')) ?? '';
  return {
    active_interface: /\bdev\s+(\S+)/.exec(line)?.[1] ?? null,
    gateway: /\bvia\s+(\S+)/.exec(line)?.[1] ?? null,
  };
}

export function parseWifiLink(output: string): { ssid: string | null; signal_dbm: number | null; link_speed_mbit: number | null } {
  const ssid = /\bSSID:\s*(.+)$/m.exec(output)?.[1]?.trim() ?? /ESSID:"([^"]*)"/.exec(output)?.[1]?.trim() ?? null;
  const signal = /\bsignal:\s*(-?\d+(?:\.\d+)?)\s*dBm/i.exec(output)?.[1] ?? /Signal level=(-?\d+(?:\.\d+)?)\s*dBm/i.exec(output)?.[1];
  const speed = /\b(?:tx )?bitrate:\s*(\d+(?:\.\d+)?)\s*MBit\/s/i.exec(output)?.[1] ?? /Bit Rate[:=](\d+(?:\.\d+)?)\s*Mb\/s/i.exec(output)?.[1];
  return {
    ssid: ssid && ssid !== 'off/any' ? ssid : null,
    signal_dbm: numberOrNull(signal),
    link_speed_mbit: numberOrNull(speed),
  };
}

export function parseDfPk(output: string, path: string): AdminTelemetry['system']['disk'] {
  const lines = output.trim().split('\n');
  const fields = lines[1]?.trim().split(/\s+/) ?? [];
  if (fields.length < 6) return { path, filesystem: null, size_kb: null, used_kb: null, available_kb: null, used_percent: null, error: 'df output did not contain a data row' };
  return {
    path,
    filesystem: fields[0] ?? null,
    size_kb: numberOrNull(fields[1]),
    used_kb: numberOrNull(fields[2]),
    available_kb: numberOrNull(fields[3]),
    used_percent: numberOrNull(fields[4]?.replace('%', '')),
    error: null,
  };
}

export function parseSystemctlShow(output: string, serviceName: string): AdminTelemetry['system']['systemd_user_service'] {
  const values = Object.fromEntries(output.split('\n').map((line) => {
    const index = line.indexOf('=');
    return index === -1 ? ['', ''] : [line.slice(0, index), line.slice(index + 1)];
  }).filter(([key]) => key));
  return {
    name: serviceName,
    active: values.ActiveState ?? null,
    sub: values.SubState ?? null,
    loaded: values.LoadState ?? null,
    error: null,
  };
}

export function parseLpstatPrinters(output: string): { default_printer: string | null; printers: Array<{ name: string; status: string; paper_status: 'ok' | 'empty' | 'low' | 'unknown'; paper_hint: string | null }> } {
  let default_printer: string | null = null;
  const printers: Array<{ name: string; status: string; paper_status: 'ok' | 'empty' | 'low' | 'unknown'; paper_hint: string | null }> = [];
  for (const line of output.split('\n')) {
    const defaultMatch = /^system default destination:\s*(.+)$/i.exec(line.trim());
    if (defaultMatch) default_printer = defaultMatch[1]?.trim() ?? null;
    const printerMatch = /^printer\s+(\S+)\s+(.+)$/i.exec(line.trim());
    if (printerMatch?.[1] && printerMatch[2]) {
      const status = printerMatch[2].trim();
      const paper = parsePrinterPaperStatus(status);
      printers.push({ name: printerMatch[1], status, paper_status: paper.status, paper_hint: paper.hint });
    }
  }
  return { default_printer, printers };
}

export function parsePortListeners(output: string, port: number): string[] {
  const portPattern = new RegExp(`(?:^|[:.])${port}(?:\\s|$)`);
  return output.split('\n').map((line) => line.trim()).filter((line) => line && portPattern.test(line));
}

function lanIps(): AdminTelemetry['network']['lan_ips'] {
  const entries: AdminTelemetry['network']['lan_ips'] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.internal) continue;
      entries.push({ interface: name, address: address.address, family: address.family, internal: address.internal });
    }
  }
  return entries;
}

async function fileText(path: string): Promise<string | null> {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch {
    return null;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function wirelessInterfaceNames(): Promise<string[]> {
  try {
    const names = await readdir('/sys/class/net');
    const wireless = await Promise.all(names.map(async (name) => ((await pathExists(join('/sys/class/net', name, 'wireless'))) ? name : null)));
    return wireless.filter((name): name is string => Boolean(name));
  } catch {
    return [];
  }
}

async function ethernetStatuses(): Promise<AdminTelemetry['network']['ethernet']> {
  try {
    const names = await readdir('/sys/class/net');
    const wireless = new Set(await wirelessInterfaceNames());
    const rows = await Promise.all(names.filter((name) => name !== 'lo' && !wireless.has(name)).map(async (name) => ({
      interface: name,
      operstate: await fileText(join('/sys/class/net', name, 'operstate')),
      carrier: (await fileText(join('/sys/class/net', name, 'carrier'))) === '1' ? true : ((await fileText(join('/sys/class/net', name, 'carrier'))) === '0' ? false : null),
      speed_mbit: numberOrNull(await fileText(join('/sys/class/net', name, 'speed')) ?? undefined),
    })));
    return rows;
  } catch {
    return [];
  }
}

async function collectWifi(activeInterface: string | null, runner: CommandRunner): Promise<AdminTelemetry['network']['wifi']> {
  const wireless = await wirelessInterfaceNames();
  const iface = activeInterface && wireless.includes(activeInterface) ? activeInterface : (wireless[0] ?? null);
  if (!iface) return { active: false, interface: null, ssid: null, signal_dbm: null, link_speed_mbit: null, raw: null, error: null };
  const iw = await runner('iw', ['dev', iface, 'link']);
  const raw = iw.stdout || iw.stderr;
  if (iw.code === 0 && !/Not connected/i.test(raw)) {
    const parsed = parseWifiLink(raw);
    return { active: iface === activeInterface || Boolean(parsed.ssid), interface: iface, raw, error: null, ...parsed };
  }
  const iwconfig = await runner('iwconfig', [iface]);
  const fallbackRaw = iwconfig.stdout || iwconfig.stderr || raw;
  const parsed = parseWifiLink(fallbackRaw);
  return { active: iface === activeInterface || Boolean(parsed.ssid), interface: iface, raw: fallbackRaw || null, error: iwconfig.code === 0 ? null : trimOrNull(iw.stderr || iwconfig.stderr), ...parsed };
}

async function collectDns(url: string | null): Promise<AdminTelemetry['network']['dns']> {
  if (!url) return { status: 'unconfigured', target: null, addresses: [], error: null };
  try {
    const parsed = new URL(url);
    const addresses = await lookup(parsed.hostname, { all: true });
    return { status: 'ok', target: parsed.hostname, addresses: addresses.map((address) => address.address), error: null };
  } catch (error) {
    return { status: 'error', target: url, addresses: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function collectCentralApi(url: string | null, fetchImpl: typeof fetch, timeoutMs: number): Promise<AdminTelemetry['network']['central_api']> {
  if (!url) return { status: 'unconfigured', url: null, http_status: null, error: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL('/healthz', url).toString(), { method: 'GET', signal: controller.signal });
    return { status: response.ok ? 'ok' : 'error', url, http_status: response.status, error: response.ok ? null : `HTTP ${response.status}` };
  } catch (error) {
    return { status: 'error', url, http_status: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function collectDisk(path: string, runner: CommandRunner): Promise<AdminTelemetry['system']['disk']> {
  const df = await runner('df', ['-Pk', path]);
  if (df.code !== 0) return { path, filesystem: null, size_kb: null, used_kb: null, available_kb: null, used_percent: null, error: trimOrNull(df.stderr) ?? 'df failed' };
  return parseDfPk(df.stdout, path);
}

async function collectSystemdService(serviceName: string, runner: CommandRunner): Promise<AdminTelemetry['system']['systemd_user_service']> {
  const result = await runner('systemctl', ['--user', 'show', serviceName, '--property=ActiveState,SubState,LoadState', '--no-pager']);
  if (result.code !== 0) return { name: serviceName, active: null, sub: null, loaded: null, error: trimOrNull(result.stderr || result.stdout) ?? 'systemctl --user show failed' };
  return parseSystemctlShow(result.stdout, serviceName);
}

async function collectPortBind(port: number, host: string, runner: CommandRunner): Promise<AdminTelemetry['system']['port_bind']> {
  const result = await runner('ss', ['-ltnp']);
  if (result.code !== 0) return { port, host, listeners: [], raw: result.stdout || null, error: trimOrNull(result.stderr) ?? 'ss failed' };
  return { port, host, listeners: parsePortListeners(result.stdout, port), raw: result.stdout, error: null };
}

async function collectSerial(configuredPath: string): Promise<AdminTelemetry['hardware']['serial_ch340']> {
  try {
    const paths: string[] = [];
    try {
      const entries = await readdir('/dev/serial/by-id');
      paths.push(...entries.filter((entry) => /ch340|1a86|usb_serial/i.test(entry)).map((entry) => join('/dev/serial/by-id', entry)));
    } catch {
      // /dev/serial/by-id is absent on machines without USB serial devices.
    }
    const configuredExists = await pathExists(configuredPath);
    if (configuredExists && !paths.includes(configuredPath)) paths.unshift(configuredPath);
    return { configured_path: configuredPath, detected_paths: paths, exists: configuredExists, error: null };
  } catch (error) {
    return { configured_path: configuredPath, detected_paths: [], exists: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function collectCups(runner: CommandRunner): Promise<AdminTelemetry['hardware']['cups']> {
  const printers = await runner('lpstat', ['-p', '-d']);
  const queue = await runner('lpstat', ['-o']);
  if (printers.code !== 0 && queue.code !== 0) return { default_printer: null, printers: [], queue: [], error: trimOrNull(printers.stderr || queue.stderr) ?? 'lpstat failed' };
  const parsed = parseLpstatPrinters(printers.stdout);
  return { ...parsed, queue: queue.stdout.split('\n').map((line) => line.trim()).filter(Boolean), error: printers.code === 0 ? null : trimOrNull(printers.stderr) };
}


function buildPeripheralReadiness(env: NodeJS.ProcessEnv, serial: AdminTelemetry['hardware']['serial_ch340'], cups: AdminTelemetry['hardware']['cups']): AdminTelemetry['hardware']['peripherals'] {
  const tokenConfig = peripheralConfig(env.KIOSK_TOKEN_SLOT_MODE ?? env.KIOSK_TOKEN_INPUT_MODE ?? env.KIOSK_TOKEN_INPUT, 'optional');
  const printerConfig = peripheralConfig(env.KIOSK_PRINTER_MODE ?? env.KIOSK_PRINTER, 'optional');
  const defaultPrinter = cups.default_printer ?? cups.printers[0]?.name ?? null;
  const printerPresent = Boolean(defaultPrinter);
  const selectedPrinter = defaultPrinter ? cups.printers.find((printer) => printer.name === defaultPrinter) ?? cups.printers[0] : null;
  const printerStatusText = selectedPrinter?.status ?? cups.error ?? 'no CUPS printer detected';
  const printerProblem = /disabled|stopped|rejecting|offline|error|failed/i.test(printerStatusText) || Boolean(cups.error && printerConfig === 'required');
  const paperStatus = selectedPrinter?.paper_status ?? (printerPresent ? 'unknown' : 'unknown');

  const tokenOk = tokenConfig === 'not_installed' || serial.exists;
  const printerOk = printerConfig === 'not_installed' || (printerPresent && !printerProblem);
  const paperOk = printerConfig === 'not_installed' || paperStatus === 'ok';

  return [
    {
      id: 'token_slot',
      label: 'Token / coin input',
      kind: 'token_input',
      configured: tokenConfig,
      present: serial.exists,
      operating: tokenConfig === 'not_installed' ? null : serial.exists,
      status: tokenConfig === 'not_installed' ? 'not_applicable' : (tokenOk ? 'ok' : (tokenConfig === 'required' ? 'error' : 'warning')),
      detail: tokenConfig === 'not_installed'
        ? 'Not equipped on this kiosk profile'
        : (serial.exists ? `Detected ${serial.configured_path}` : `Not detected at ${serial.configured_path}`),
    },
    {
      id: 'thermal_printer',
      label: 'Thermal printer',
      kind: 'printer',
      configured: printerConfig,
      present: printerPresent,
      operating: printerConfig === 'not_installed' ? null : (printerPresent && !printerProblem),
      status: printerConfig === 'not_installed' ? 'not_applicable' : (printerOk ? 'ok' : (printerConfig === 'required' ? 'error' : 'warning')),
      detail: printerConfig === 'not_installed'
        ? 'Not equipped on this kiosk profile'
        : (printerPresent ? `${defaultPrinter}: ${printerStatusText}` : (cups.error ?? 'No CUPS printer detected')),
    },
    {
      id: 'printer_paper',
      label: 'Printer paper',
      kind: 'printer_paper',
      configured: printerConfig,
      present: printerPresent,
      operating: printerConfig === 'not_installed' ? null : (paperStatus === 'ok' ? true : (paperStatus === 'empty' ? false : null)),
      status: printerConfig === 'not_installed' ? 'not_applicable' : (paperOk ? 'ok' : (paperStatus === 'empty' && printerConfig === 'required' ? 'error' : 'warning')),
      detail: printerConfig === 'not_installed'
        ? 'Not required because this kiosk has no printer'
        : (paperStatus === 'ok'
          ? 'CUPS reports no paper fault'
          : paperStatus === 'empty'
            ? `Paper missing or media fault: ${selectedPrinter?.paper_hint ?? printerStatusText}`
            : paperStatus === 'low'
              ? `Paper low: ${selectedPrinter?.paper_hint ?? printerStatusText}`
              : 'Paper sensor status is unknown; require operator confirmation before print campaigns'),
    },
  ];
}

export async function collectAdminTelemetry(config: LocalBackendConfig, options: TelemetryOptions = {}): Promise<AdminTelemetry> {
  const env = options.env ?? process.env;
  const runner = options.runner ?? defaultCommandRunner;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? 2_000;
  const route = await runner('ip', ['route', 'show', 'default']);
  const parsedRoute = route.code === 0 ? parseDefaultRoute(route.stdout) : { active_interface: null, gateway: null };
  const centralUrl = centralApiUrl(env);
  const diskPath = env.TELEMETRY_DISK_PATH ?? process.cwd();
  const serviceName = env.LOCAL_BACKEND_SYSTEMD_SERVICE ?? 'retail-kiosk-local-backend.service';

  const [dns, central_api, wifi, ethernet, disk, systemd_user_service, port_bind, serial_ch340, cups] = await Promise.all([
    collectDns(centralUrl),
    collectCentralApi(centralUrl, fetchImpl, timeoutMs),
    collectWifi(parsedRoute.active_interface, runner),
    ethernetStatuses(),
    collectDisk(diskPath, runner),
    collectSystemdService(serviceName, runner),
    collectPortBind(config.port, config.host, runner),
    collectSerial(config.serialTokenPort),
    collectCups(runner),
  ]);
  const peripherals = buildPeripheralReadiness(env, serial_ch340, cups);

  return {
    generated_at: now.toISOString(),
    host: {
      hostname: hostname(),
      node_version: process.version,
      node_versions: process.versions,
      process_uptime_seconds: Math.floor(process.uptime()),
      os_uptime_seconds: Math.floor(osUptime()),
    },
    network: {
      lan_ips: lanIps(),
      active_interface: parsedRoute.active_interface,
      gateway: parsedRoute.gateway,
      dns,
      central_api,
      wifi,
      ethernet,
    },
    system: {
      disk,
      systemd_user_service,
      port_bind,
    },
    hardware: {
      serial_ch340,
      cups,
      peripherals,
    },
  };
}
