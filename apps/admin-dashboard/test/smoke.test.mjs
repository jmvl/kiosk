import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import {
  createCentralApiDashboardClient,
  createFleetOverview,
  createKioskDetail,
  createTestPrintAction,
  dashboardPackage,
  renderDashboardHtml,
  seedDashboardState,
} from '../dist/index.js';

describe('@retail-kiosk/admin-dashboard v1', () => {
  it('declares the baseline scripts and shared-types dependency', () => {
    assert.equal(packageJson.name, '@retail-kiosk/admin-dashboard');
    assert.equal(packageJson.scripts.build, 'tsc -p tsconfig.build.json && vite build');
    assert.equal(packageJson.scripts.dev, 'vite --host 127.0.0.1');
    assert.equal(packageJson.scripts.typecheck, 'tsc -p tsconfig.json --noEmit');
    assert.equal(packageJson.scripts.test, 'pnpm build && node --test test/smoke.test.mjs');
    assert.equal(packageJson.dependencies['@retail-kiosk/shared-types'], 'workspace:*');
    assert.equal(dashboardPackage.version, 'v1-minimal-ops-cockpit');
  });

  it('builds a fleet overview for the seed fake kiosk', () => {
    const overview = createFleetOverview(seedDashboardState);

    assert.equal(overview.total_kiosks, 1);
    assert.equal(overview.healthy_kiosks, 1);
    assert.equal(overview.total_queue_length, 3);
    assert.equal(overview.rows[0].kiosk_id, 'kiosk-hq-001');
    assert.equal(overview.rows[0].health, 'healthy');
    assert.equal(overview.rows[0].active_package, 'chocomel@0.1.0');
    assert.equal(overview.rows[0].last_session_at, '2026-06-12T23:58:12.000Z');
    assert.equal(overview.rows[0].pending_command_count, 1);
    assert.equal(overview.rows[0].last_command_status, 'succeeded');
  });

  it('builds kiosk detail with queue, health, active package, and command lifecycle', () => {
    const detail = createKioskDetail(seedDashboardState, 'kiosk-hq-001');

    assert.equal(detail.queue_length, 3);
    assert.equal(detail.last_session_at, '2026-06-12T23:58:12.000Z');
    assert.equal(detail.health, 'healthy');
    assert.equal(detail.active_package, 'chocomel@0.1.0');
    assert.deepEqual(detail.command_timeline.map((event) => event.status), ['accepted', 'running', 'succeeded']);
    assert.equal(detail.actions.test_print.path, '/v1/admin/kiosks/kiosk-hq-001/commands');
    assert.equal(detail.actions.test_print.supported_by_current_central_api, false);
  });

  it('renders a minimal ops cockpit HTML smoke view', () => {
    const html = renderDashboardHtml(seedDashboardState);

    assert.match(html, /Retail kiosk fleet/);
    assert.match(html, /HQ fake kiosk 001/);
    assert.match(html, /Queue length/);
    assert.match(html, /chocomel@0\.1\.0/);
    assert.match(html, /data-command-type="test_print"/);
    assert.match(html, /fake print completed/);
  });

  it('wraps the fleet table in an accessible responsive scroll region', () => {
    const html = renderDashboardHtml(seedDashboardState);

    assert.match(html, /id="fleet-table-scroll-help"/);
    assert.match(html, /Scroll horizontally inside the fleet table/);
    assert.match(html, /<div class="table-scroll" role="region" aria-label="Fleet overview table" aria-describedby="fleet-table-scroll-help" tabindex="0">\s*<table>/);
    assert.match(html, /\.table-scroll \{ max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; \}/);
    assert.match(html, /\.table-scroll table \{ min-width: 53rem; \}/);
  });

  it('renders unsupported test print as a disabled non-actionable control', () => {
    const html = renderDashboardHtml(seedDashboardState);

    assert.match(html, /<button[^>]*data-command-type="test_print"[^>]*disabled/);
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /data-supported="false"/);
    assert.match(html, /Fake test print enqueue is not available in this Q3 fake-dashboard build/);
  });

  it('describes the test print action without claiming live central enqueue support', () => {
    const action = createTestPrintAction('kiosk hq/001');

    assert.equal(action.method, 'POST');
    assert.equal(action.path, '/v1/admin/kiosks/kiosk%20hq%2F001/commands');
    assert.equal(action.body.type, 'test_print');
    assert.equal(action.body.requires_confirmation, false);
    assert.equal(action.supported_by_current_central_api, false);
    assert.match(action.note, /polling\/results/);
  });

  it('adapts to currently supported central API command routes', async () => {
    const calls = [];
    const client = createCentralApiDashboardClient('http://central.test/', async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/healthz')) return Response.json({ ok: true });
      if (String(url).includes('/commands?limit=2')) return Response.json({ ok: true, commands: seedDashboardState.kiosks[0].pending_commands });
      return Response.json({ ok: true });
    });

    assert.deepEqual(await client.health(), { ok: true });
    assert.equal((await client.pollCommands('kiosk-hq-001', 2))[0].command_id, 'cmd_test_print_pending');
    assert.deepEqual(await client.recordCommandResult('cmd_test_print_001', {
      command_id: 'cmd_test_print_001',
      kiosk_id: 'kiosk-hq-001',
      status: 'succeeded',
      completed_at: '2026-06-12T23:56:07.000Z',
      evidence: { hardware_mode: 'fake' },
    }), { ok: true });

    assert.equal(calls[0].url, 'http://central.test/healthz');
    assert.equal(calls[1].url, 'http://central.test/v1/kiosks/kiosk-hq-001/commands?limit=2');
    assert.equal(calls[2].url, 'http://central.test/v1/commands/cmd_test_print_001/result');
    assert.equal(calls[2].init.method, 'POST');
  });

  it('ships the React scheduler and telemetry UI against local APIs', () => {
    const assetsDir = join(import.meta.dirname, '..', 'dist-web', 'assets');
    const bundleName = readdirSync(assetsDir).find((name) => name.endsWith('.js'));
    assert.ok(bundleName);
    const bundle = readFileSync(join(assetsDir, bundleName), 'utf8');

    assert.match(bundle, /Day timeline and module assignment/);
    assert.match(bundle, /\/schedules/);
    assert.match(bundle, /Publish local only marks the local draft valid\/cached/);
    assert.match(bundle, /Production publish is not implemented/);
    assert.match(bundle, /Critical kiosk hardware/);
    assert.match(bundle, /Printer paper/);
    assert.match(bundle, /Network and hardware status cards/);
    assert.match(bundle, /\/admin\/api\/telemetry/);
    assert.match(bundle, /IP address/);
    assert.match(bundle, /Printer \/ CUPS/);
    assert.match(bundle, /Serial adapter/);
    assert.match(bundle, /Game run log/);
    assert.match(bundle, /\/admin\/api\/game-runs/);
    assert.match(bundle, /Recent sessions, events, and tickets/);
    assert.match(bundle, /Ticket \/ print/);
    assert.match(bundle, /\/admin\/api\/campaign-preview/);
    assert.match(bundle, /Campaign content preview/);
    assert.match(bundle, /Dr\. Oetker quiz, outcomes, tickets, and wheel map/);
    assert.match(bundle, /HQ-only preview/);
    assert.match(bundle, /read-only v1/);
    assert.match(bundle, /Store operator content editing/);
    assert.match(bundle, /boundary_note/);
    assert.match(bundle, /Visual segment mapping/);
  });
});
