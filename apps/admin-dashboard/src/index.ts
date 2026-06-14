import type {
  Command,
  CommandResult,
  CommandStatus,
  CommandType,
  HeartbeatPayload,
  SessionSnapshot,
} from '@retail-kiosk/shared-types';

export type KioskHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'stale';

export interface DashboardCommandEvent {
  command_id: string;
  kiosk_id: string;
  type: CommandType;
  status: Exclude<CommandStatus, 'pending'>;
  observed_at: string;
  message?: string;
  evidence: Record<string, unknown>;
}

export interface DashboardKioskRecord {
  kiosk_id: string;
  location_id: string;
  display_name: string;
  heartbeat: HeartbeatPayload;
  heartbeat_received_at: string;
  last_session?: SessionSnapshot;
  pending_commands: Command[];
  command_events: DashboardCommandEvent[];
}

export interface DashboardState {
  generated_at: string;
  kiosks: DashboardKioskRecord[];
}

export interface FleetOverviewRow {
  kiosk_id: string;
  location_id: string;
  display_name: string;
  health: KioskHealth;
  queue_length: number;
  last_session_at: string | null;
  active_package: string;
  pending_command_count: number;
  last_command_status: CommandStatus | null;
}

export interface FleetOverview {
  generated_at: string;
  total_kiosks: number;
  healthy_kiosks: number;
  degraded_kiosks: number;
  unhealthy_kiosks: number;
  stale_kiosks: number;
  total_queue_length: number;
  rows: FleetOverviewRow[];
}

export interface KioskDetailView {
  kiosk_id: string;
  location_id: string;
  display_name: string;
  health: KioskHealth;
  queue_length: number;
  last_session_at: string | null;
  active_package: string;
  versions: {
    agent: string;
    runtime: string;
    player: string;
    schedule: number;
  };
  hardware: {
    printer: HeartbeatPayload['printer_status'];
    token: HeartbeatPayload['token_status'];
  };
  last_error: string | null;
  pending_commands: Command[];
  command_timeline: DashboardCommandEvent[];
  actions: {
    test_print: TestPrintAction;
  };
}

export interface TestPrintAction {
  label: string;
  type: 'test_print';
  method: 'POST';
  path: string;
  body: {
    kiosk_id: string;
    type: 'test_print';
    payload: {
      reason: 'admin_dashboard_smoke';
    };
    requires_confirmation: false;
  };
  supported_by_current_central_api: boolean;
  note: string;
}

export interface CentralApiDashboardClient {
  health(): Promise<{ ok: boolean }>;
  pollCommands(kioskId: string, limit?: number): Promise<Command[]>;
  recordCommandResult(commandId: string, result: CommandResult): Promise<{ ok: boolean }>;
}

export const dashboardPackage = {
  name: '@retail-kiosk/admin-dashboard',
  kind: 'app',
  version: 'v1-minimal-ops-cockpit',
} as const;

const seedNow = '2026-06-13T00:00:00.000Z';

export const seedDashboardState: DashboardState = {
  generated_at: seedNow,
  kiosks: [
    {
      kiosk_id: 'kiosk-hq-001',
      location_id: 'hq-lab',
      display_name: 'HQ fake kiosk 001',
      heartbeat_received_at: seedNow,
      heartbeat: {
        kiosk_id: 'kiosk-hq-001',
        location_id: 'hq-lab',
        agent_version: '0.1.0-fake',
        runtime_version: '0.1.0-fake',
        player_version: '0.1.0-fake',
        active_package: 'chocomel@0.1.0',
        schedule_version: 7,
        uptime_seconds: 14_400,
        queue_length: 3,
        printer_status: 'online',
        token_status: 'online',
        runtime_health: 'healthy',
        player_health: 'healthy',
        last_session_at: '2026-06-12T23:58:12.000Z',
        last_error: null,
        clock_skew_seconds: 1,
      },
      last_session: {
        session_id: 'sess_fake_001',
        kiosk_id: 'kiosk-hq-001',
        package_id: 'chocomel',
        package_version: '0.1.0',
        state: 'completed',
        started_at: '2026-06-12T23:57:40.000Z',
        updated_at: '2026-06-12T23:58:12.000Z',
        completed_at: '2026-06-12T23:58:12.000Z',
      },
      pending_commands: [
        {
          command_id: 'cmd_test_print_pending',
          kiosk_id: 'kiosk-hq-001',
          type: 'test_print',
          status: 'pending',
          payload: { reason: 'admin_dashboard_smoke' },
          issued_at: '2026-06-12T23:59:40.000Z',
          expires_at: '2026-06-13T00:05:00.000Z',
          requires_confirmation: false,
          idempotency_key: 'test-print:kiosk-hq-001:2026-06-13T00:00',
        },
      ],
      command_events: [
        {
          command_id: 'cmd_test_print_001',
          kiosk_id: 'kiosk-hq-001',
          type: 'test_print',
          status: 'accepted',
          observed_at: '2026-06-12T23:56:01.000Z',
          message: 'agent accepted test print command',
          evidence: { adapter: 'fake_printer' },
        },
        {
          command_id: 'cmd_test_print_001',
          kiosk_id: 'kiosk-hq-001',
          type: 'test_print',
          status: 'running',
          observed_at: '2026-06-12T23:56:03.000Z',
          message: 'fake print job started',
          evidence: { job_id: 'fake-print-001' },
        },
        {
          command_id: 'cmd_test_print_001',
          kiosk_id: 'kiosk-hq-001',
          type: 'test_print',
          status: 'succeeded',
          observed_at: '2026-06-12T23:56:07.000Z',
          message: 'fake print completed',
          evidence: { job_id: 'fake-print-001', hardware_mode: 'fake' },
        },
      ],
    },
  ],
};

export function deriveKioskHealth(kiosk: DashboardKioskRecord, now = new Date(seedNow)): KioskHealth {
  const heartbeatAgeMs = now.getTime() - new Date(kiosk.heartbeat_received_at).getTime();
  if (!Number.isFinite(heartbeatAgeMs) || heartbeatAgeMs > 5 * 60 * 1000) return 'stale';
  if (kiosk.heartbeat.runtime_health === 'unhealthy' || kiosk.heartbeat.player_health === 'unhealthy') return 'unhealthy';
  if (
    kiosk.heartbeat.runtime_health === 'degraded'
    || kiosk.heartbeat.player_health === 'degraded'
    || kiosk.heartbeat.printer_status !== 'online'
    || kiosk.heartbeat.token_status !== 'online'
  ) return 'degraded';
  if (kiosk.heartbeat.runtime_health === 'unknown' || kiosk.heartbeat.player_health === 'unknown') return 'unknown';
  return 'healthy';
}

export function createFleetOverview(state: DashboardState, now = new Date(state.generated_at)): FleetOverview {
  const rows = state.kiosks
    .map((kiosk): FleetOverviewRow => {
      const sortedEvents = [...kiosk.command_events].sort((a, b) => b.observed_at.localeCompare(a.observed_at));
      return {
        kiosk_id: kiosk.kiosk_id,
        location_id: kiosk.location_id,
        display_name: kiosk.display_name,
        health: deriveKioskHealth(kiosk, now),
        queue_length: kiosk.heartbeat.queue_length,
        last_session_at: kiosk.heartbeat.last_session_at ?? kiosk.last_session?.completed_at ?? null,
        active_package: kiosk.heartbeat.active_package,
        pending_command_count: kiosk.pending_commands.length,
        last_command_status: sortedEvents[0]?.status ?? kiosk.pending_commands[0]?.status ?? null,
      };
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return {
    generated_at: state.generated_at,
    total_kiosks: rows.length,
    healthy_kiosks: rows.filter((row) => row.health === 'healthy').length,
    degraded_kiosks: rows.filter((row) => row.health === 'degraded').length,
    unhealthy_kiosks: rows.filter((row) => row.health === 'unhealthy').length,
    stale_kiosks: rows.filter((row) => row.health === 'stale').length,
    total_queue_length: rows.reduce((sum, row) => sum + row.queue_length, 0),
    rows,
  };
}

export function createTestPrintAction(kioskId: string): TestPrintAction {
  return {
    label: 'Queue fake test print',
    type: 'test_print',
    method: 'POST',
    path: `/v1/admin/kiosks/${encodeURIComponent(kioskId)}/commands`,
    body: {
      kiosk_id: kioskId,
      type: 'test_print',
      payload: { reason: 'admin_dashboard_smoke' },
      requires_confirmation: false,
    },
    supported_by_current_central_api: false,
    note: 'Fake test print enqueue is not available in this Q3 fake-dashboard build. Central API currently exposes kiosk command polling/results only; no real or fake admin enqueue route is wired for live use.',
  };
}

export function createKioskDetail(state: DashboardState, kioskId: string, now = new Date(state.generated_at)): KioskDetailView {
  const kiosk = state.kiosks.find((candidate) => candidate.kiosk_id === kioskId);
  if (!kiosk) throw new Error(`kiosk ${kioskId} was not found in dashboard state`);
  return {
    kiosk_id: kiosk.kiosk_id,
    location_id: kiosk.location_id,
    display_name: kiosk.display_name,
    health: deriveKioskHealth(kiosk, now),
    queue_length: kiosk.heartbeat.queue_length,
    last_session_at: kiosk.heartbeat.last_session_at ?? kiosk.last_session?.completed_at ?? null,
    active_package: kiosk.heartbeat.active_package,
    versions: {
      agent: kiosk.heartbeat.agent_version,
      runtime: kiosk.heartbeat.runtime_version,
      player: kiosk.heartbeat.player_version,
      schedule: kiosk.heartbeat.schedule_version,
    },
    hardware: {
      printer: kiosk.heartbeat.printer_status,
      token: kiosk.heartbeat.token_status,
    },
    last_error: kiosk.heartbeat.last_error,
    pending_commands: [...kiosk.pending_commands],
    command_timeline: [...kiosk.command_events].sort((a, b) => a.observed_at.localeCompare(b.observed_at)),
    actions: {
      test_print: createTestPrintAction(kiosk.kiosk_id),
    },
  };
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderFleetOverviewHtml(overview: FleetOverview): string {
  const rows = overview.rows.map((row) => `
      <tr data-kiosk-id="${escapeHtml(row.kiosk_id)}">
        <td><a href="#${escapeHtml(row.kiosk_id)}">${escapeHtml(row.display_name)}</a></td>
        <td>${escapeHtml(row.location_id)}</td>
        <td><span class="status status-${escapeHtml(row.health)}">${escapeHtml(row.health)}</span></td>
        <td>${escapeHtml(row.queue_length)}</td>
        <td>${escapeHtml(row.last_session_at ?? 'never')}</td>
        <td>${escapeHtml(row.active_package)}</td>
        <td>${escapeHtml(row.pending_command_count)}</td>
        <td>${escapeHtml(row.last_command_status ?? 'none')}</td>
      </tr>`).join('');

  return `<section data-view="fleet-overview">
    <h1>Retail kiosk fleet</h1>
    <dl>
      <dt>Total kiosks</dt><dd>${overview.total_kiosks}</dd>
      <dt>Healthy</dt><dd>${overview.healthy_kiosks}</dd>
      <dt>Degraded</dt><dd>${overview.degraded_kiosks}</dd>
      <dt>Unhealthy</dt><dd>${overview.unhealthy_kiosks}</dd>
      <dt>Stale</dt><dd>${overview.stale_kiosks}</dd>
      <dt>Total queue length</dt><dd>${overview.total_queue_length}</dd>
    </dl>
    <p id="fleet-table-scroll-help" class="table-scroll-hint">Scroll horizontally inside the fleet table to review every column on narrow screens.</p>
    <div class="table-scroll" role="region" aria-label="Fleet overview table" aria-describedby="fleet-table-scroll-help" tabindex="0">
      <table>
        <thead><tr><th>Kiosk</th><th>Location</th><th>Health</th><th>Queue</th><th>Last session</th><th>Active package</th><th>Pending commands</th><th>Last command</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

export function renderKioskDetailHtml(detail: KioskDetailView): string {
  const timeline = detail.command_timeline.map((event) => `
      <li data-command-id="${escapeHtml(event.command_id)}"><strong>${escapeHtml(event.type)}</strong> ${escapeHtml(event.status)} at ${escapeHtml(event.observed_at)} — ${escapeHtml(event.message ?? '')}</li>`).join('');
  const pending = detail.pending_commands.map((command) => `
      <li data-command-id="${escapeHtml(command.command_id)}">${escapeHtml(command.type)} ${escapeHtml(command.status)} expires ${escapeHtml(command.expires_at)}</li>`).join('');

  return `<section data-view="kiosk-detail" id="${escapeHtml(detail.kiosk_id)}">
    <h2>${escapeHtml(detail.display_name)}</h2>
    <dl>
      <dt>Health</dt><dd>${escapeHtml(detail.health)}</dd>
      <dt>Queue length</dt><dd>${escapeHtml(detail.queue_length)}</dd>
      <dt>Last session</dt><dd>${escapeHtml(detail.last_session_at ?? 'never')}</dd>
      <dt>Active package</dt><dd>${escapeHtml(detail.active_package)}</dd>
      <dt>Printer</dt><dd>${escapeHtml(detail.hardware.printer)}</dd>
      <dt>Token input</dt><dd>${escapeHtml(detail.hardware.token)}</dd>
      <dt>Last error</dt><dd>${escapeHtml(detail.last_error ?? 'none')}</dd>
    </dl>
    <h3>Versions</h3>
    <p>agent ${escapeHtml(detail.versions.agent)} · runtime ${escapeHtml(detail.versions.runtime)} · player ${escapeHtml(detail.versions.player)} · schedule ${escapeHtml(detail.versions.schedule)}</p>
    <h3>Actions</h3>
    <button data-command-type="test_print" data-method="${detail.actions.test_print.method}" data-path="${escapeHtml(detail.actions.test_print.path)}" data-supported="${detail.actions.test_print.supported_by_current_central_api}" disabled aria-disabled="true" title="${escapeHtml(detail.actions.test_print.note)}">${escapeHtml(detail.actions.test_print.label)}</button>
    <p>${escapeHtml(detail.actions.test_print.note)}</p>
    <h3>Pending commands</h3>
    <ul>${pending}</ul>
    <h3>Command lifecycle</h3>
    <ol>${timeline}</ol>
  </section>`;
}

export function renderDashboardHtml(state: DashboardState = seedDashboardState): string {
  const overview = createFleetOverview(state);
  const details = overview.rows.map((row) => renderKioskDetailHtml(createKioskDetail(state, row.kiosk_id))).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Retail kiosk admin dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    .table-scroll { max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-scroll table { min-width: 53rem; }
    .table-scroll-hint { margin-bottom: 0.5rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    .status-healthy { color: #116329; }
    .status-degraded, .status-stale, .status-unknown { color: #8a5a00; }
    .status-unhealthy { color: #a40e26; }
  </style>
</head>
<body>
${renderFleetOverviewHtml(overview)}
${details}
</body>
</html>`;
}

export function createCentralApiDashboardClient(baseUrl: string, fetchImpl: typeof fetch = fetch): CentralApiDashboardClient {
  const root = baseUrl.replace(/\/$/, '');
  async function parseJson<T>(response: Response): Promise<T> {
    const body = await response.json() as T;
    if (!response.ok) throw new Error(`central API request failed: ${response.status}`);
    return body;
  }

  return {
    async health() {
      return parseJson<{ ok: boolean }>(await fetchImpl(`${root}/healthz`));
    },
    async pollCommands(kioskId, limit = 25) {
      const payload = await parseJson<{ ok: boolean; commands: Command[] }>(await fetchImpl(`${root}/v1/kiosks/${encodeURIComponent(kioskId)}/commands?limit=${limit}`));
      return payload.commands;
    },
    async recordCommandResult(commandId, result) {
      return parseJson<{ ok: boolean }>(await fetchImpl(`${root}/v1/commands/${encodeURIComponent(commandId)}/result`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result),
      }));
    },
  };
}

export type AdminDashboardPackage = typeof dashboardPackage;
