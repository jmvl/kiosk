import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type HealthResponse = {
  status: string;
  runtime: string;
  fake_hardware: boolean;
  hardware_mode?: 'fake' | 'real';
  adapters: Record<string, { adapter: string; status: string; fake?: boolean; last_event_at?: string }>;
};

type RuntimeState = {
  runtime: {
    kiosk_id: string;
    mode: string;
    current_session_id: string | null;
    active_package_id: string;
    active_package_version: string;
    local_sequence: number;
    last_heartbeat_at: string | null;
    last_error: string | null;
    updated_at: string;
  };
  scheduler: {
    active_schedule: Schedule | null;
    pending_schedule: Schedule | null;
    current_module: RuntimeModule | null;
    next_module: RuntimeModule | null;
  };
  current_session: null | Record<string, unknown>;
  latest_ticket: null | {
    ticket_code: string;
    print_status: string;
    created_at: string;
    printed_at?: string;
    render_payload?: Record<string, unknown>;
  };
  adapters: HealthResponse['adapters'];
};

type AdminTelemetry = {
  generated_at: string;
  host: {
    hostname: string;
    process_uptime_seconds: number;
    os_uptime_seconds: number;
  };
  network: {
    lan_ips: Array<{ interface: string; address: string; family: string; internal: boolean }>;
    active_interface: string | null;
    gateway: string | null;
    dns: { status: 'ok' | 'error' | 'unconfigured'; target: string | null; addresses: string[]; error: string | null };
    central_api: { status: 'ok' | 'error' | 'unconfigured'; url: string | null; http_status: number | null; error: string | null };
    wifi: { active: boolean; interface: string | null; ssid: string | null; signal_dbm: number | null; link_speed_mbit: number | null; error: string | null };
    ethernet: Array<{ interface: string; operstate: string | null; carrier: boolean | null; speed_mbit: number | null }>;
  };
  system: {
    disk: { path: string; filesystem: string | null; size_kb: number | null; used_kb: number | null; available_kb: number | null; used_percent: number | null; error: string | null };
    systemd_user_service: { name: string; active: string | null; sub: string | null; loaded: string | null; error: string | null };
  };
  hardware: {
    serial_ch340: { configured_path: string; detected_paths: string[]; exists: boolean; error: string | null };
    cups: {
      default_printer: string | null;
      printers: Array<{ name: string; status: string; paper_status?: 'ok' | 'empty' | 'low' | 'unknown'; paper_hint?: string | null }>;
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
};

type GameRunLogEntry = {
  session_id: string;
  kiosk_id: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  package_id: string;
  package_version: string;
  module_id: string | null;
  module_version: string | null;
  state: string;
  token_event: null | {
    occurred_at: string;
    source: string | null;
    denomination_cents: number | null;
    payload: Record<string, unknown> | null;
  };
  result_payload: Record<string, unknown> | null;
  prize: string | null;
  ticket_code: string | null;
  print_status: string | null;
  error: string | null;
};

type GameRunsResponse = { runs: GameRunLogEntry[] };

type ActivationMode = 'immediate' | 'next-safe-boundary' | 'scheduled';
type ValidationStatus = 'draft' | 'valid' | 'invalid';
type CacheStatus = 'pending' | 'cached' | 'failed';

type RuntimeModule = {
  schedule_id: string;
  slot_id: string | null;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  starts_at: string | null;
  ends_at: string | null;
  activation_mode: ActivationMode;
};

type ScheduleSlot = {
  slot_id: string;
  position: number;
  starts_at: string | null;
  ends_at: string | null;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  cache_status: CacheStatus;
  payload: Record<string, unknown>;
};

type Schedule = {
  schedule_id: string;
  status: 'draft';
  timezone: string;
  activation_mode: ActivationMode;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  validation_status: ValidationStatus;
  cache_status: CacheStatus;
  previous_known_good_schedule: Schedule | null;
  created_at: string;
  updated_at: string;
  slots: ScheduleSlot[];
};

type SchedulesResponse = { schedules: Schedule[] };

type ScheduleForm = {
  schedule_id: string;
  timezone: string;
  activation_mode: ActivationMode;
  package_id: string;
  package_version: string;
  module_id: string;
  module_version: string;
  slot_starts_at: string;
  slot_ends_at: string;
};

type LoadState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

const endpoint = (path: string) => path;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return await response.json() as T;
}

function useKioskData() {
  const [health, setHealth] = React.useState<LoadState<HealthResponse>>({ status: 'loading' });
  const [state, setState] = React.useState<LoadState<RuntimeState>>({ status: 'loading' });
  const [schedules, setSchedules] = React.useState<LoadState<SchedulesResponse>>({ status: 'loading' });
  const [telemetry, setTelemetry] = React.useState<LoadState<AdminTelemetry>>({ status: 'loading' });
  const [gameRuns, setGameRuns] = React.useState<LoadState<GameRunsResponse>>({ status: 'loading' });
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);

  const refresh = React.useCallback(async () => {
    const loadedAt = new Date();
    try {
      const [healthData, stateData, telemetryData, runData] = await Promise.all([
        fetchJson<HealthResponse>('/health'),
        fetchJson<RuntimeState>('/state'),
        fetchJson<AdminTelemetry>('/admin/api/telemetry'),
        fetchJson<GameRunsResponse>('/admin/api/game-runs'),
      ]);
      setHealth({ status: 'ready', data: healthData });
      setState({ status: 'ready', data: stateData });
      setTelemetry({ status: 'ready', data: telemetryData });
      setGameRuns({ status: 'ready', data: runData });
      setLastRefresh(loadedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown load error';
      setHealth((current) => current.status === 'ready' ? current : { status: 'error', message });
      setState((current) => current.status === 'ready' ? current : { status: 'error', message });
      setTelemetry((current) => current.status === 'ready' ? current : { status: 'error', message });
      setGameRuns((current) => current.status === 'ready' ? current : { status: 'error', message });
    }

    try {
      const scheduleData = await fetchJson<SchedulesResponse>('/schedules');
      setSchedules({ status: 'ready', data: scheduleData });
      setLastRefresh(loadedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduler unavailable';
      setSchedules((current) => current.status === 'ready' ? current : { status: 'error', message });
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { health, state, schedules, telemetry, gameRuns, lastRefresh, refresh };
}

function Pill({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

function toneForStatus(value: string | null | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  if (!value) return 'neutral';
  if (['ok', 'online', 'idle', 'playing', 'printed', 'healthy', 'valid', 'cached'].includes(value)) return 'good';
  if (['booting', 'unknown', 'created', 'draft', 'pending', 'scheduled', 'next-safe-boundary', 'immediate', 'warning'].includes(value)) return 'warn';
  if (['error', 'failed', 'offline', 'unhealthy', 'invalid'].includes(value)) return 'bad';
  if (value === 'not_applicable') return 'neutral';
  return 'neutral';
}

function LoginCard() {
  return (
    <section className="login-card" aria-label="Authentication status">
      <div>
        <p className="section-label">Access</p>
        <h2>Operator console</h2>
        <p>Authentication is intentionally parked for this bootstrap build. The next iteration should back this form with database-backed users and roles.</p>
      </div>
      <form className="login-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Email
          <input type="email" placeholder="operator@acmea.tech" disabled />
        </label>
        <label>
          Password
          <input type="password" placeholder="Authentication coming next" disabled />
        </label>
        <button disabled>Sign in later</button>
      </form>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

type DisplayDiagnostics = {
  viewport: string;
  screen: string;
  orientation: string;
  devicePixelRatio: string;
  fullscreen: string;
  playerUrl: string;
  userAgent: string;
};

function readDisplayDiagnostics(): DisplayDiagnostics {
  const orientation = window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  return {
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen.width}×${window.screen.height}`,
    orientation,
    devicePixelRatio: String(window.devicePixelRatio || 1),
    fullscreen: document.fullscreenElement ? 'active' : 'not active',
    playerUrl: `${window.location.origin}/player`,
    userAgent: navigator.userAgent,
  };
}

function DisplayDiagnosticsPanel() {
  const [diagnostics, setDiagnostics] = React.useState<DisplayDiagnostics>(() => readDisplayDiagnostics());
  React.useEffect(() => {
    const update = () => setDiagnostics(readDisplayDiagnostics());
    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', update);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('fullscreenchange', update);
    };
  }, []);
  return (
    <section className="panel display-panel" aria-label="Display diagnostics">
      <div className="panel-heading">
        <div>
          <p className="section-label">Display</p>
          <h2>Player diagnostics</h2>
        </div>
        <Pill tone={diagnostics.orientation === 'portrait' ? 'good' : 'warn'}>{diagnostics.orientation}</Pill>
      </div>
      <div className="status-card-grid display-grid">
        <StatusCard title="Viewport" value={diagnostics.viewport} hint={`screen ${diagnostics.screen}`} tone="neutral" />
        <StatusCard title="Fullscreen" value={diagnostics.fullscreen} hint={`device pixel ratio ${diagnostics.devicePixelRatio}`} tone={diagnostics.fullscreen === 'active' ? 'good' : 'warn'} />
        <StatusCard title="Player URL" value="/player" hint={diagnostics.playerUrl} tone="neutral" />
      </div>
      <p className="muted diagnostic-user-agent">{diagnostics.userAgent}</p>
    </section>
  );
}

function PackageReadinessPanel({ runtime, scheduler }: { runtime: RuntimeState['runtime'] | null; scheduler: RuntimeState['scheduler'] | null }) {
  const current = scheduler?.current_module;
  const next = scheduler?.next_module;
  const schedule = scheduler?.active_schedule ?? scheduler?.pending_schedule;
  const cache = schedule?.cache_status ?? 'unknown';
  const validation = schedule?.validation_status ?? 'unknown';
  return (
    <section className="panel readiness-panel" aria-label="Package readiness">
      <div className="panel-heading">
        <div>
          <p className="section-label">Package</p>
          <h2>Readiness and launch mode</h2>
        </div>
        <div className="pill-row">
          <Pill tone={toneForStatus(validation)}>{validation}</Pill>
          <Pill tone={toneForStatus(cache)}>{cache}</Pill>
        </div>
      </div>
      <div className="status-card-grid readiness-grid">
        <StatusCard title="Active package" value={`${runtime?.active_package_id ?? 'unknown'}@${runtime?.active_package_version ?? '?'}`} hint="served by local runtime" tone="neutral" />
        <StatusCard title="Launch trigger" value="token, scheduled, autoplay, or operator" hint="token is optional by campaign design" tone="good" />
        <StatusCard title="Current module" value={current?.module_id ?? 'none active'} hint={current ? `${current.package_id}@${current.package_version}` : 'waiting for schedule or manual start'} tone={current ? 'good' : 'warn'} />
        <StatusCard title="Next module" value={next?.module_id ?? 'none queued'} hint={next ? formatDateTime(next.starts_at) : 'no next slot'} tone={next ? 'good' : 'neutral'} />
      </div>
    </section>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'open';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatRunDuration(value: number | null): string {
  if (value === null) return 'open';
  if (value < 1000) return `${value}ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function GameRunLogPanel({ runs }: { runs: LoadState<GameRunsResponse> }) {
  const entries = runs.status === 'ready' ? runs.data.runs : [];
  return (
    <section className="panel game-runs-panel" aria-label="Recent game run log">
      <div className="panel-heading">
        <div>
          <p className="section-label">Game run log</p>
          <h2>Recent sessions, events, and tickets</h2>
        </div>
        <Pill tone={entries.length > 0 ? 'good' : 'neutral'}>{entries.length} / 20</Pill>
      </div>
      <p className="muted">Shows the latest 20 local sessions. Fake token and print controls below append new HQ-only runs here after refresh.</p>
      {runs.status === 'loading' ? <p className="muted">Loading run log…</p> : null}
      {runs.status === 'error' ? <p className="error-text">Run log API: {runs.message}</p> : null}
      {entries.length > 0 ? (
        <div className="run-table-scroll" role="region" aria-label="Latest game runs table" tabIndex={0}>
          <table className="run-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Session</th>
                <th>Module / package</th>
                <th>State</th>
                <th>Token</th>
                <th>Result</th>
                <th>Ticket / print</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((run) => (
                <tr key={run.session_id}>
                  <td>
                    <strong>{formatDateTime(run.started_at)}</strong>
                    <small>{formatRunDuration(run.duration_ms)}</small>
                  </td>
                  <td><code>{run.session_id.slice(0, 12)}</code></td>
                  <td>
                    <strong>{run.module_id ?? 'runtime module'}</strong>
                    <small>{run.package_id}@{run.package_version}{run.module_version ? ` · ${run.module_version}` : ''}</small>
                  </td>
                  <td><Pill tone={toneForStatus(run.state)}>{run.state}</Pill></td>
                  <td>{run.token_event ? `${run.token_event.source ?? 'token'} · ${run.token_event.denomination_cents ?? 0}¢` : 'none'}</td>
                  <td>{run.prize ?? (run.result_payload ? 'result recorded' : 'pending')}</td>
                  <td>
                    {run.ticket_code ? <code>{run.ticket_code}</code> : 'no ticket'}
                    <small>{run.print_status ?? 'not printed'}</small>
                  </td>
                  <td>{run.error ? <span className="error-text">{run.error}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : runs.status === 'ready' ? <p className="muted">No game sessions recorded yet.</p> : null}
    </section>
  );
}

function createDefaultSlotTimes(): { start: string; end: string } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start: toDatetimeLocal(start.toISOString()), end: toDatetimeLocal(end.toISOString()) };
}

function formFromSchedule(schedule: Schedule | null, runtime: RuntimeState['runtime'] | null): ScheduleForm {
  const firstSlot = schedule?.slots[0];
  const defaults = createDefaultSlotTimes();
  return {
    schedule_id: schedule?.schedule_id ?? 'local-day',
    timezone: schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    activation_mode: schedule?.activation_mode ?? 'scheduled',
    package_id: schedule?.package_id ?? runtime?.active_package_id ?? 'chocomel-wheel',
    package_version: schedule?.package_version ?? runtime?.active_package_version ?? '1.0.0',
    module_id: schedule?.module_id ?? firstSlot?.module_id ?? 'wheel-v1',
    module_version: schedule?.module_version ?? firstSlot?.module_version ?? '2026.06.13',
    slot_starts_at: toDatetimeLocal(firstSlot?.starts_at) || defaults.start,
    slot_ends_at: toDatetimeLocal(firstSlot?.ends_at) || defaults.end,
  };
}

function activeSchedule(schedules: Schedule[]): Schedule | null {
  return schedules[0] ?? null;
}

function modulePosition(schedule: Schedule | null, now = Date.now()): { current: ScheduleSlot | null; next: ScheduleSlot | null } {
  const slots = schedule?.slots ?? [];
  const sorted = [...slots].sort((a, b) => Date.parse(a.starts_at ?? '') - Date.parse(b.starts_at ?? ''));
  const current = sorted.find((slot) => {
    const start = slot.starts_at ? Date.parse(slot.starts_at) : Number.NEGATIVE_INFINITY;
    const end = slot.ends_at ? Date.parse(slot.ends_at) : Number.POSITIVE_INFINITY;
    return start <= now && now < end;
  }) ?? null;
  const next = sorted.find((slot) => (slot.starts_at ? Date.parse(slot.starts_at) : Number.POSITIVE_INFINITY) > now) ?? null;
  return { current, next };
}

function timelineBounds(slots: ScheduleSlot[]): { start: number; end: number } {
  const dated = slots.flatMap((slot) => [slot.starts_at, slot.ends_at]).filter((value): value is string => Boolean(value)).map(Date.parse).filter((value) => !Number.isNaN(value));
  if (dated.length === 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end: start.getTime() + 24 * 60 * 60 * 1000 };
  }
  const start = new Date(Math.min(...dated));
  start.setHours(0, 0, 0, 0);
  const end = new Date(Math.max(...dated));
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'unknown';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatStorage(kb: number | null | undefined): string {
  if (kb === null || kb === undefined || !Number.isFinite(kb)) return 'unknown';
  const gb = kb / 1024 / 1024;
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
}

function primaryLanIp(telemetry: AdminTelemetry): { address: string; iface: string } | null {
  const active = telemetry.network.lan_ips.find((ip) => ip.interface === telemetry.network.active_interface && ip.family === 'IPv4')
    ?? telemetry.network.lan_ips.find((ip) => ip.family === 'IPv4')
    ?? telemetry.network.lan_ips[0];
  return active ? { address: active.address, iface: active.interface } : null;
}

function StatusCard({ title, value, hint, tone = 'neutral' }: { title: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  return (
    <article className={`status-card status-card--${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function PeripheralReadinessPanel({ telemetry }: { telemetry: LoadState<AdminTelemetry> }) {
  const peripherals = telemetry.status === 'ready' ? telemetry.data.hardware.peripherals ?? [] : [];
  const blocking = peripherals.filter((item) => item.status === 'error').length;
  const warnings = peripherals.filter((item) => item.status === 'warning').length;
  return (
    <section className="panel peripheral-panel" aria-label="Critical peripheral readiness">
      <div className="panel-heading">
        <div>
          <p className="section-label">Peripherals</p>
          <h2>Critical kiosk hardware</h2>
        </div>
        <div className="pill-row">
          {blocking > 0 ? <Pill tone="bad">{blocking} blocking</Pill> : null}
          {warnings > 0 ? <Pill tone="warn">{warnings} warning</Pill> : null}
          {blocking === 0 && warnings === 0 && peripherals.length > 0 ? <Pill tone="good">ready</Pill> : null}
          {telemetry.status !== 'ready' ? <Pill tone="warn">loading</Pill> : null}
        </div>
      </div>
      <p className="muted">Each kiosk profile declares whether token input and printer hardware are required, optional, or not installed. Printer paper is checked from CUPS when the printer reports media faults; otherwise the panel requires operator confirmation.</p>
      {telemetry.status === 'loading' ? <p className="muted">Loading peripheral readiness…</p> : null}
      {telemetry.status === 'error' ? <p className="error-text">Peripheral telemetry: {telemetry.message}</p> : null}
      {peripherals.length > 0 ? (
        <div className="peripheral-grid">
          {peripherals.map((item) => (
            <article className={`peripheral-card peripheral-card--${item.status}`} key={item.id}>
              <div className="peripheral-card__top">
                <div>
                  <span>{item.configured.replace('_', ' ')}</span>
                  <strong>{item.label}</strong>
                </div>
                <Pill tone={toneForStatus(item.status)}>{item.status.replace('_', ' ')}</Pill>
              </div>
              <dl>
                <div><dt>Present</dt><dd>{item.configured === 'not_installed' ? 'not equipped' : (item.present ? 'yes' : 'no')}</dd></div>
                <div><dt>Operating</dt><dd>{item.operating === null ? 'not applicable' : (item.operating ? 'yes' : 'no')}</dd></div>
              </dl>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      ) : telemetry.status === 'ready' ? <p className="muted">No peripheral profile returned by the local runtime.</p> : null}
    </section>
  );
}

function TelemetryPanel({ telemetry }: { telemetry: LoadState<AdminTelemetry> }) {
  if (telemetry.status === 'loading') {
    return <section className="panel telemetry-panel" aria-label="Device telemetry"><p className="muted">Loading live device telemetry…</p></section>;
  }
  if (telemetry.status === 'error') {
    return <section className="panel telemetry-panel" aria-label="Device telemetry"><p className="error-text">Telemetry API: {telemetry.message}</p></section>;
  }

  const data = telemetry.data;
  const lan = primaryLanIp(data);
  const wifi = data.network.wifi;
  const serial = data.hardware.serial_ch340;
  const cups = data.hardware.cups;
  const disk = data.system.disk;
  const service = data.system.systemd_user_service;
  const central = data.network.central_api;
  const printer = cups.default_printer ?? cups.printers[0]?.name ?? 'no CUPS printer';
  const printerHint = cups.error ?? `${cups.printers.length} configured · ${cups.queue.length} queued`;
  const serviceValue = service.active ? `${service.active}${service.sub ? ` / ${service.sub}` : ''}` : 'unknown';

  return (
    <section className="panel telemetry-panel" aria-label="Device telemetry">
      <div className="panel-heading">
        <div>
          <p className="section-label">Device telemetry</p>
          <h2>Network and hardware status cards</h2>
        </div>
        <Pill tone="neutral">live from /admin/api/telemetry</Pill>
      </div>
      <div className="status-card-grid">
        <StatusCard title="IP address" value={lan?.address ?? 'no LAN IP'} hint={lan ? `${lan.iface} · active ${data.network.active_interface ?? 'unknown'}` : 'waiting for network interface'} tone={lan ? 'good' : 'warn'} />
        <StatusCard title="Wi-Fi" value={wifi.ssid ?? (wifi.interface ? 'not connected' : 'not detected')} hint={wifi.interface ? `${wifi.interface}${wifi.signal_dbm === null ? '' : ` · ${wifi.signal_dbm} dBm`}${wifi.link_speed_mbit === null ? '' : ` · ${wifi.link_speed_mbit} Mbit/s`}` : 'wired or no wireless adapter'} tone={wifi.ssid ? 'good' : 'neutral'} />
        <StatusCard title="Gateway" value={data.network.gateway ?? 'unknown'} hint={data.network.active_interface ? `via ${data.network.active_interface}` : 'default route unavailable'} tone={data.network.gateway ? 'good' : 'warn'} />
        <StatusCard title="Central API" value={central.status} hint={central.url ? `${central.url}${central.http_status ? ` · HTTP ${central.http_status}` : ''}` : 'not configured for this kiosk'} tone={toneForStatus(central.status)} />
        <StatusCard title="Serial adapter" value={serial.exists ? 'configured path present' : (serial.detected_paths.length ? 'detected alternate path' : 'not detected')} hint={serial.detected_paths[0] ?? serial.configured_path} tone={serial.exists || serial.detected_paths.length > 0 ? 'good' : 'warn'} />
        <StatusCard title="Printer / CUPS" value={printer} hint={printerHint} tone={cups.error ? 'warn' : (cups.printers.length ? 'good' : 'warn')} />
        <StatusCard title="Disk" value={disk.used_percent === null ? 'unknown' : `${disk.used_percent}% used`} hint={`${formatStorage(disk.available_kb)} free on ${disk.path}`} tone={disk.used_percent === null ? 'neutral' : (disk.used_percent > 90 ? 'bad' : disk.used_percent > 75 ? 'warn' : 'good')} />
        <StatusCard title="Uptime" value={formatUptime(data.host.os_uptime_seconds)} hint={`${data.host.hostname} · app ${formatUptime(data.host.process_uptime_seconds)}`} tone="neutral" />
        <StatusCard title="Service" value={serviceValue} hint={service.error ?? service.name} tone={toneForStatus(service.active)} />
      </div>
    </section>
  );
}

function SchedulerPanel({ schedules, runtime, scheduler, onRefresh }: { schedules: LoadState<SchedulesResponse>; runtime: RuntimeState['runtime'] | null; scheduler: RuntimeState['scheduler'] | null; onRefresh: () => Promise<void> }) {
  const scheduleList = schedules.status === 'ready' ? schedules.data.schedules : [];
  const selectedSchedule = activeSchedule(scheduleList);
  const [form, setForm] = React.useState<ScheduleForm>(() => formFromSchedule(selectedSchedule, runtime));
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    setForm(formFromSchedule(selectedSchedule, runtime));
  }, [selectedSchedule?.schedule_id, selectedSchedule?.updated_at, runtime?.active_package_id, runtime?.active_package_version]);

  const { current, next } = modulePosition(selectedSchedule);
  const currentRuntimeModule = scheduler?.current_module;
  const nextRuntimeModule = scheduler?.next_module;
  const pendingSchedule = scheduler?.pending_schedule;
  const bounds = timelineBounds(selectedSchedule?.slots ?? []);
  const duration = Math.max(bounds.end - bounds.start, 1);

  async function saveSchedule(validation_status: ValidationStatus, cache_status: CacheStatus) {
    setMessage(validation_status === 'valid' ? 'Publishing local validated draft…' : 'Saving local draft…');
    const slotStart = fromDatetimeLocal(form.slot_starts_at);
    const slotEnd = fromDatetimeLocal(form.slot_ends_at);
    const payload = {
      timezone: form.timezone,
      activation_mode: form.activation_mode,
      package_id: form.package_id,
      package_version: form.package_version,
      module_id: form.module_id,
      module_version: form.module_version,
      validation_status,
      cache_status,
      slots: [{
        slot_id: selectedSchedule?.slots[0]?.slot_id ?? `${form.schedule_id}-primary`,
        starts_at: slotStart,
        ends_at: slotEnd,
        package_id: form.package_id,
        package_version: form.package_version,
        module_id: form.module_id,
        module_version: form.module_version,
        cache_status,
        payload: { source: 'admin-scheduler-ui', local_publish_only: validation_status === 'valid' },
      }],
    };
    try {
      await fetchJson<{ schedule: Schedule }>(`/schedules/${encodeURIComponent(form.schedule_id)}/draft`, { method: 'PUT', body: JSON.stringify(payload) });
      setMessage(validation_status === 'valid' ? 'Local draft marked valid and cached. Production publish is not implemented in this bootstrap.' : 'Draft saved to local scheduler.');
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Schedule save failed');
    }
  }

  return (
    <section className="panel scheduler-panel" aria-label="Scheduler">
      <div className="panel-heading">
        <div>
          <p className="section-label">Scheduler</p>
          <h2>Day timeline and module assignment</h2>
        </div>
        <div className="pill-row">
          <Pill tone={toneForStatus(selectedSchedule?.validation_status)}>{selectedSchedule?.validation_status ?? 'no draft'}</Pill>
          <Pill tone={toneForStatus(selectedSchedule?.cache_status)}>{selectedSchedule?.cache_status ?? 'cache pending'}</Pill>
        </div>
      </div>

      {schedules.status === 'loading' ? <p className="muted">Loading local schedule data…</p> : null}
      {schedules.status === 'error' ? <p className="error-text">Scheduler API: {schedules.message}</p> : null}

      <div className="scheduler-summary">
        <Metric label="Activation" value={selectedSchedule?.activation_mode ?? form.activation_mode} hint={pendingSchedule ? `pending ${pendingSchedule.schedule_id} at safe boundary` : (selectedSchedule ? `timezone ${selectedSchedule.timezone}` : 'new local draft')} />
        <Metric label="Current module" value={currentRuntimeModule?.module_id ?? current?.module_id ?? 'none active'} hint={currentRuntimeModule ? `${currentRuntimeModule.package_id}@${currentRuntimeModule.package_version}` : (current ? `${current.package_id}@${current.package_version}` : 'based on local runtime')} />
        <Metric label="Next module" value={nextRuntimeModule?.module_id ?? next?.module_id ?? 'none queued'} hint={nextRuntimeModule ? `${nextRuntimeModule.activation_mode} · ${formatDateTime(nextRuntimeModule.starts_at)}` : (next ? formatDateTime(next.starts_at) : 'add a future slot')} />
      </div>

      <div className="timeline" role="list" aria-label="Scheduled module slots">
        {(selectedSchedule?.slots.length ? selectedSchedule.slots : [{
          slot_id: 'draft-preview',
          position: 0,
          starts_at: fromDatetimeLocal(form.slot_starts_at),
          ends_at: fromDatetimeLocal(form.slot_ends_at),
          package_id: form.package_id,
          package_version: form.package_version,
          module_id: form.module_id,
          module_version: form.module_version,
          cache_status: 'pending' as CacheStatus,
          payload: {},
        }]).map((slot) => {
          const start = slot.starts_at ? Date.parse(slot.starts_at) : bounds.start;
          const end = slot.ends_at ? Date.parse(slot.ends_at) : start + 60 * 60 * 1000;
          const left = Math.max(0, Math.min(100, ((start - bounds.start) / duration) * 100));
          const width = Math.max(8, Math.min(100 - left, ((end - start) / duration) * 100));
          return (
            <article className="timeline-slot" role="listitem" key={slot.slot_id} style={{ marginLeft: `${left}%`, width: `${width}%` }}>
              <strong>{slot.module_id}</strong>
              <span>{formatDateTime(slot.starts_at)} – {formatDateTime(slot.ends_at)}</span>
              <small>{slot.package_id}@{slot.package_version} · {slot.cache_status}</small>
            </article>
          );
        })}
      </div>

      <form className="scheduler-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Schedule ID
          <input value={form.schedule_id} onChange={(event) => setForm({ ...form, schedule_id: event.target.value })} />
        </label>
        <label>
          Activation mode
          <select value={form.activation_mode} onChange={(event) => setForm({ ...form, activation_mode: event.target.value as ActivationMode })}>
            <option value="scheduled">Scheduled</option>
            <option value="next-safe-boundary">Next safe boundary</option>
            <option value="immediate">Immediate</option>
          </select>
        </label>
        <label>
          Package
          <input value={form.package_id} onChange={(event) => setForm({ ...form, package_id: event.target.value })} />
        </label>
        <label>
          Package version
          <input value={form.package_version} onChange={(event) => setForm({ ...form, package_version: event.target.value })} />
        </label>
        <label>
          Module
          <input value={form.module_id} onChange={(event) => setForm({ ...form, module_id: event.target.value })} />
        </label>
        <label>
          Module version
          <input value={form.module_version} onChange={(event) => setForm({ ...form, module_version: event.target.value })} />
        </label>
        <label>
          Slot starts
          <input type="datetime-local" value={form.slot_starts_at} onChange={(event) => setForm({ ...form, slot_starts_at: event.target.value })} />
        </label>
        <label>
          Slot ends
          <input type="datetime-local" value={form.slot_ends_at} onChange={(event) => setForm({ ...form, slot_ends_at: event.target.value })} />
        </label>
        <div className="scheduler-actions">
          <button type="button" onClick={() => void saveSchedule('draft', 'pending')}>Save draft</button>
          <button type="button" className="secondary" onClick={() => void saveSchedule('valid', 'cached')}>Publish local draft</button>
        </div>
      </form>
      <p className="scheduler-note">Publish local only marks the local draft valid/cached through the A4 scheduler API. It is not a production rollout or authentication claim.</p>
      {message ? <p className="action-message">{message}</p> : null}
    </section>
  );
}

function App() {
  const { health, state, schedules, telemetry, gameRuns, lastRefresh, refresh } = useKioskData();
  const runtime = state.status === 'ready' ? state.data.runtime : null;
  const scheduler = state.status === 'ready' ? state.data.scheduler : null;
  const latestTicket = state.status === 'ready' ? state.data.latest_ticket : null;
  const adapters = health.status === 'ready' ? health.data.adapters : state.status === 'ready' ? state.data.adapters : {};
  const [actionMessage, setActionMessage] = React.useState<string>('');

  async function runFakeToken() {
    setActionMessage('Starting token-triggered session…');
    try {
      await fetchJson('/dev/token', { method: 'POST', body: JSON.stringify({ source: 'admin-ui', trigger: 'token' }) });
      setActionMessage('Token-triggered session is playing. Run full smoke to create ticket evidence.');
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Token-triggered session failed');
    }
  }

  async function runNoTokenStart() {
    setActionMessage('Starting no-token campaign session…');
    try {
      await fetchJson('/dev/session/start', { method: 'POST', body: JSON.stringify({ source: 'admin-ui', trigger: 'no-token-campaign' }) });
      setActionMessage('No-token session is playing. Use this for animation/video or open campaigns.');
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No-token session failed');
    }
  }

  async function runTestPrint() {
    setActionMessage('Sending test print…');
    try {
      await fetchJson('/print/test', { method: 'POST', body: JSON.stringify({ result_payload: { prize: 'ADMIN_UI_TEST', source: 'admin-ui' }, render_payload: { prize: 'ADMIN_UI_TEST', fake: true } }) });
      setActionMessage('Fake test print completed.');
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Test print failed');
    }
  }

  async function runFullSmokeFlow() {
    setActionMessage('Running full HQ smoke: start session, print ticket, refresh log…');
    try {
      const currentMode = state.status === 'ready' ? state.data.runtime.mode : null;
      if (!state || currentMode === 'idle' || currentMode === 'booting' || currentMode === null) {
        await fetchJson('/dev/session/start', { method: 'POST', body: JSON.stringify({ source: 'admin-ui', trigger: 'full-smoke-no-token' }) });
      }
      const response = await fetchJson<{ ticket?: { ticket_code?: string }; print?: { status?: string } }>('/print/test', {
        method: 'POST',
        body: JSON.stringify({
          result_payload: { prize: 'HQ_FULL_SMOKE', source: 'admin-ui', token_required: false },
          render_payload: { prize: 'HQ_FULL_SMOKE', title: 'HQ smoke passed', body: 'Runtime created a session, ticket, print job, and reset.', fake: true },
        }),
      });
      setActionMessage(`Full HQ smoke completed: ${response.ticket?.ticket_code ?? 'ticket created'} · ${response.print?.status ?? 'print recorded'}.`);
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Full HQ smoke failed');
    }
  }

  async function resetSession() {
    setActionMessage('Resetting current session…');
    try {
      await fetchJson('/session/reset', { method: 'POST', body: JSON.stringify({ reason: 'admin_ui_reset' }) });
      setActionMessage('Session reset to idle.');
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Session reset failed');
    }
  }

  async function setMaintenanceMode(enabled: boolean) {
    setActionMessage(enabled ? 'Entering maintenance mode…' : 'Exiting maintenance mode…');
    try {
      await fetchJson(enabled ? '/maintenance/enter' : '/maintenance/exit', { method: 'POST' });
      setActionMessage(enabled ? 'Maintenance mode active. Customer play is disabled.' : 'Maintenance mode cleared. Runtime is idle.');
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Maintenance command failed');
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="section-label">Retail kiosk platform</p>
          <h1>Kiosk operations cockpit</h1>
          <p className="lede">Monitor the HQ kiosk, schedule local modules, check local hardware adapters, and exercise token, no-token, ticket, and print paths before physical device rollout.</p>
        </div>
        <div className="topbar-actions">
          <a className="secondary-link" href="/player">Open player</a>
          <button onClick={() => void refresh()}>Refresh</button>
        </div>
      </header>

      <section className="status-strip" aria-label="Kiosk summary">
        <Metric label="Kiosk" value={runtime?.kiosk_id ?? 'loading'} hint={runtime?.active_package_id ?? 'package pending'} />
        <Metric label="Mode" value={runtime?.mode ?? 'loading'} hint={runtime?.updated_at ? new Date(runtime.updated_at).toLocaleString() : 'waiting for runtime'} />
        <Metric label="Sequence" value={runtime ? String(runtime.local_sequence) : '…'} hint="append-only local event count" />
        <Metric label="Last refresh" value={lastRefresh ? lastRefresh.toLocaleTimeString() : '…'} hint="auto-refreshes every 5s" />
      </section>

      <div className="grid">
        <PeripheralReadinessPanel telemetry={telemetry} />

        <TelemetryPanel telemetry={telemetry} />

        <DisplayDiagnosticsPanel />

        <PackageReadinessPanel runtime={runtime} scheduler={scheduler} />

        <SchedulerPanel schedules={schedules} runtime={runtime} scheduler={scheduler} onRefresh={refresh} />

        <GameRunLogPanel runs={gameRuns} />

        <section className="panel primary-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">Runtime</p>
              <h2>Live service status</h2>
            </div>
            {health.status === 'ready' ? <Pill tone={toneForStatus(health.data.status)}>{health.data.status}</Pill> : <Pill tone="warn">loading</Pill>}
          </div>
          {health.status === 'error' ? <p className="error-text">{health.message}</p> : null}
          <div className="adapter-list">
            {Object.entries(adapters).map(([name, adapter]) => (
              <div className="adapter-row" key={name}>
                <div>
                  <strong>{name}</strong>
                  <span>{adapter.adapter}{adapter.fake ? ' · fake mode' : ''}</span>
                </div>
                <Pill tone={toneForStatus(adapter.status)}>{adapter.status}</Pill>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">Ticket</p>
              <h2>Latest print outcome</h2>
            </div>
            <Pill tone={toneForStatus(latestTicket?.print_status)}>{latestTicket?.print_status ?? 'none'}</Pill>
          </div>
          {latestTicket ? (
            <div className="ticket-box">
              <code>{latestTicket.ticket_code}</code>
              <p>{latestTicket.render_payload?.prize ? `Prize: ${String(latestTicket.render_payload.prize)}` : 'No prize payload recorded'}</p>
              <small>{latestTicket.printed_at ? `Printed ${new Date(latestTicket.printed_at).toLocaleString()}` : `Created ${new Date(latestTicket.created_at).toLocaleString()}`}</small>
            </div>
          ) : <p className="muted">No ticket recorded yet.</p>}
        </section>

        <section className="panel action-panel">
          <div>
            <p className="section-label">Validation controls</p>
            <h2>HQ smoke test</h2>
            <p>Campaigns may start from a token, schedule, operator action, or autoplay. These fake-mode controls validate each path before public deployment.</p>
          </div>
          <div className="button-row action-button-grid">
            <button onClick={() => void runFullSmokeFlow()}>Run full HQ smoke</button>
            <button className="secondary" onClick={() => void runFakeToken()}>Start with token</button>
            <button className="secondary" onClick={() => void runNoTokenStart()}>Start without token</button>
            <button className="secondary" onClick={() => void runTestPrint()}>Print active session</button>
            <button className="secondary" onClick={() => void resetSession()}>Reset session</button>
            <button className="secondary" onClick={() => void setMaintenanceMode(runtime?.mode !== 'maintenance')}>{runtime?.mode === 'maintenance' ? 'Exit maintenance' : 'Enter maintenance'}</button>
          </div>
          {actionMessage ? <p className="action-message">{actionMessage}</p> : null}
        </section>

        <LoginCard />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
