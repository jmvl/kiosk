import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  createLocalBackendRuntime,
  createLocalBackendServer,
  createSession,
  createTicket,
  appendEvent,
  CupsPrinterAdapter,
  collectAdminTelemetry,
  FakePrinterAdapter,
  FakeTokenAdapter,
  localBackendConfigFromEnv,
  migrateDatabase,
  openLocalDatabase,
  parseDefaultRoute,
  parseDfPk,
  parseLpstatPrinters,
  parsePortListeners,
  parseSystemctlShow,
  parseWifiLink,
  SerialTokenAdapter,
} from '../dist/index.js';

async function testServer(config = {}, runtimeOptions = {}) {
  const { db } = testServerDb();
  const runtime = createLocalBackendRuntime({
    ...runtimeOptions,
    db,
    config: {
      devRoutesEnabled: true,
      authToken: 'test-token',
      allowedOrigins: ['http://localhost:5173'],
      ticketSecret: 'test-secret',
      ...config,
    },
  });
  const app = await createLocalBackendServer(runtime);
  return { app, runtime, auth: { authorization: 'Bearer test-token', origin: 'http://localhost:5173' } };
}

function testServerDb() {
  const dir = mkdtempSync(join(tmpdir(), 'retail-kiosk-api-'));
  const db = openLocalDatabase(join(dir, 'runtime.sqlite'));
  migrateDatabase(db);
  return { db, dir };
}

function seedTicket(db) {
  const session = createSession(db, {
    kioskId: 'HQ001',
    packageId: 'chocomel-wheel',
    packageVersion: '1.0.0',
  });
  return createTicket(db, {
    kioskId: 'HQ001',
    kioskShortId: 'HQ001',
    sessionId: session.session_id,
    packageId: 'chocomel-wheel',
    packageVersion: '1.0.0',
    campaignShortCode: 'CHO',
    renderPayload: { prize: 'sample' },
    secret: 'test-secret',
  });
}

describe('local backend admin telemetry', () => {
  it('parses read-only telemetry command outputs', () => {
    assert.deepEqual(parseDefaultRoute('default via 192.168.1.1 dev wlan0 proto dhcp src 192.168.1.117 metric 600\n'), {
      active_interface: 'wlan0',
      gateway: '192.168.1.1',
    });
    assert.deepEqual(parseWifiLink('Connected to aa:bb:cc\n\tSSID: KioskNet\n\tsignal: -47 dBm\n\ttx bitrate: 72.2 MBit/s\n'), {
      ssid: 'KioskNet',
      signal_dbm: -47,
      link_speed_mbit: 72.2,
    });
    assert.deepEqual(parseDfPk('Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root 100000 40000 60000 40% /\n', '/'), {
      path: '/',
      filesystem: '/dev/root',
      size_kb: 100000,
      used_kb: 40000,
      available_kb: 60000,
      used_percent: 40,
      error: null,
    });
    assert.deepEqual(parseSystemctlShow('LoadState=loaded\nActiveState=active\nSubState=running\n', 'retail-kiosk-local-backend.service'), {
      name: 'retail-kiosk-local-backend.service',
      active: 'active',
      sub: 'running',
      loaded: 'loaded',
      error: null,
    });
    assert.deepEqual(parseLpstatPrinters('system default destination: ICOD-PT80KM\nprinter ICOD-PT80KM is idle. enabled since Sat 13 Jun 2026\n'), {
      default_printer: 'ICOD-PT80KM',
      printers: [{ name: 'ICOD-PT80KM', status: 'is idle. enabled since Sat 13 Jun 2026', paper_status: 'ok', paper_hint: 'is idle. enabled since Sat 13 Jun 2026' }],
    });
    assert.equal(parseLpstatPrinters('printer ICOD-PT80KM media-empty-error since Sat 13 Jun 2026\n').printers[0].paper_status, 'empty');
    assert.deepEqual(parsePortListeners('LISTEN 0 511 0.0.0.0:8787 0.0.0.0:* users:(("node",pid=123,fd=18))\n', 8787), [
      'LISTEN 0 511 0.0.0.0:8787 0.0.0.0:* users:(("node",pid=123,fd=18))',
    ]);
  });

  it('collects telemetry with mocked commands and central reachability', async () => {
    const runner = async (command, args) => {
      const key = `${command} ${args.join(' ')}`;
      if (key === 'ip route show default') return { code: 0, stdout: 'default via 192.168.1.1 dev wlan0 proto dhcp\n', stderr: '' };
      if (key === 'df -Pk /tmp') return { code: 0, stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root 100000 40000 60000 40% /\n', stderr: '' };
      if (key.startsWith('systemctl --user show')) return { code: 0, stdout: 'LoadState=loaded\nActiveState=active\nSubState=running\n', stderr: '' };
      if (key === 'ss -ltnp') return { code: 0, stdout: 'LISTEN 0 511 127.0.0.1:8787 0.0.0.0:* users:(("node",pid=123,fd=18))\n', stderr: '' };
      if (key === 'lpstat -p -d') return { code: 0, stdout: 'system default destination: ICOD-PT80KM\nprinter ICOD-PT80KM is idle. enabled since Sat 13 Jun 2026\n', stderr: '' };
      if (key === 'lpstat -o') return { code: 0, stdout: 'ICOD-PT80KM-29 kiosk-test 1024 Sat 13 Jun 2026\n', stderr: '' };
      return { code: 1, stdout: '', stderr: 'not mocked' };
    };
    let centralHealthUrl = '';
    const telemetry = await collectAdminTelemetry({ ...localBackendConfigFromEnv(), host: '127.0.0.1', port: 8787, serialTokenPort: '/dev/serial/by-id/usb-1a86_USB_Serial-if00-port0' }, {
      runner,
      env: { CENTRAL_API_BASE_URL: 'http://central.example.test', TELEMETRY_DISK_PATH: '/tmp' },
      fetchImpl: async (url) => {
        centralHealthUrl = String(url);
        return new Response('ok', { status: 200 });
      },
      now: new Date('2026-06-13T12:00:00.000Z'),
    });
    assert.equal(telemetry.generated_at, '2026-06-13T12:00:00.000Z');
    assert.equal(telemetry.network.active_interface, 'wlan0');
    assert.equal(telemetry.network.gateway, '192.168.1.1');
    assert.equal(telemetry.network.central_api.status, 'ok');
    assert.equal(centralHealthUrl, 'http://central.example.test/healthz');
    assert.equal(telemetry.system.disk.used_percent, 40);
    assert.equal(telemetry.system.systemd_user_service.active, 'active');
    assert.equal(telemetry.system.port_bind.listeners.length, 1);
    assert.equal(telemetry.hardware.cups.default_printer, 'ICOD-PT80KM');
    assert.equal(telemetry.hardware.cups.printers[0].paper_status, 'ok');
    assert.deepEqual(telemetry.hardware.cups.queue, ['ICOD-PT80KM-29 kiosk-test 1024 Sat 13 Jun 2026']);
    assert.equal(telemetry.hardware.peripherals.find((item) => item.id === 'thermal_printer').status, 'ok');
    assert.equal(telemetry.hardware.peripherals.find((item) => item.id === 'printer_paper').status, 'ok');
  });


  it('reports optional/not-installed peripheral profile and printer paper faults', async () => {
    const runner = async (command, args) => {
      const key = `${command} ${args.join(' ')}`;
      if (key === 'ip route show default') return { code: 0, stdout: 'default via 192.168.1.1 dev eth0\n', stderr: '' };
      if (key === 'df -Pk /tmp') return { code: 0, stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root 100000 40000 60000 40% /\n', stderr: '' };
      if (key.startsWith('systemctl --user show')) return { code: 0, stdout: 'LoadState=loaded\nActiveState=active\nSubState=running\n', stderr: '' };
      if (key === 'ss -ltnp') return { code: 0, stdout: '', stderr: '' };
      if (key === 'lpstat -p -d') return { code: 0, stdout: 'system default destination: ICOD-PT80KM\nprinter ICOD-PT80KM media-empty-error since Sat 13 Jun 2026\n', stderr: '' };
      if (key === 'lpstat -o') return { code: 0, stdout: '', stderr: '' };
      return { code: 1, stdout: '', stderr: 'not mocked' };
    };
    const telemetry = await collectAdminTelemetry({ ...localBackendConfigFromEnv(), host: '127.0.0.1', port: 8787, serialTokenPort: '/missing-token' }, {
      runner,
      env: { TELEMETRY_DISK_PATH: '/tmp', KIOSK_TOKEN_SLOT_MODE: 'not_installed', KIOSK_PRINTER_MODE: 'required' },
      fetchImpl: async () => new Response('ok', { status: 200 }),
      now: new Date('2026-06-13T12:00:00.000Z'),
    });
    assert.equal(telemetry.hardware.peripherals.find((item) => item.id === 'token_slot').status, 'not_applicable');
    assert.equal(telemetry.hardware.peripherals.find((item) => item.id === 'thermal_printer').status, 'error');
    assert.equal(telemetry.hardware.peripherals.find((item) => item.id === 'printer_paper').status, 'error');
    assert.match(telemetry.hardware.peripherals.find((item) => item.id === 'printer_paper').detail, /Paper missing/);
  });

  it('serves authenticated telemetry before the admin static wildcard', async () => {
    const { app, auth } = await testServer({ port: 8787 });
    try {
      const response = await app.inject({ method: 'GET', url: '/admin/api/telemetry', headers: auth });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(typeof body.host.hostname, 'string');
      assert.equal(body.system.port_bind.port, 8787);
      assert.ok(Array.isArray(body.hardware.cups.printers));

      const alias = await app.inject({ method: 'GET', url: '/telemetry', headers: auth });
      assert.equal(alias.statusCode, 200);
      assert.equal(alias.json().system.port_bind.port, 8787);
    } finally {
      await app.close();
    }
  });

  it('serves read-only campaign content preview before the admin static wildcard', async () => {
    const { app, runtime, auth } = await testServer({ campaignShortCode: 'DOW' });
    try {
      seedActiveCampaign(runtime);
      const response = await app.inject({ method: 'GET', url: '/admin/api/campaign-preview', headers: auth });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.package_id, 'dr-oetker-pizza-wheel');
      assert.equal(body.access.editing_supported, false);
      assert.equal(body.access.store_operator_editing, 'disabled-read-only-v1');
      assert.match(body.access.boundary_note, /Production auth/);
      assert.equal(body.quiz.attempt_limit, 2);
      assert.equal(body.outcome_strategy.authority, 'local_backend');
      assert.equal(body.outcome_strategy.outcomes[0].outcome_id, 'standard-discount');
      assert.equal(body.ticket_templates[0].template_id, 'voucher-v1');
      assert.equal(body.bitmap_assets[0].asset_id, 'ticket-bitmap');
      assert.equal(body.qr_payload_patterns[0].qr_payload_template, 'https://promo.example.test/r/{{ticket_code}}');
      assert.equal(body.visual_wheel.segments[0].outcome_id, 'standard-discount');
    } finally {
      await app.close();
    }
  });

  it('exports local events for central sync before the admin static wildcard', async () => {
    const { app, runtime, auth } = await testServer({ kioskId: 'HQ001' });
    try {
      const first = appendEvent(runtime.db, { kioskId: 'HQ001', eventType: 'sync_test_first', payload: { ok: true }, occurredAt: '2026-06-22T10:00:00.000Z' });
      const second = appendEvent(runtime.db, { kioskId: 'HQ001', eventType: 'sync_test_second', payload: { count: 2 }, occurredAt: '2026-06-22T10:00:01.000Z' });

      const response = await app.inject({ method: 'GET', url: `/admin/api/events/export?after_sequence=${first.local_sequence}&limit=1`, headers: auth });
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.cursor.after_sequence, first.local_sequence);
      assert.equal(body.cursor.next_after_sequence, second.local_sequence);
      assert.equal(body.cursor.count, 1);
      assert.equal(body.cursor.limit, 1);
      assert.equal(body.events.length, 1);
      assert.deepEqual(body.events[0], second);

      const empty = await app.inject({ method: 'GET', url: `/admin/api/events/export?after_sequence=${second.local_sequence}`, headers: auth });
      assert.equal(empty.statusCode, 200);
      assert.deepEqual(empty.json().events, []);
    } finally {
      await app.close();
    }
  });

  it('serves admin static assets from workspace root when package start cwd is local-backend', async () => {
    const originalCwd = process.cwd();
    const root = mkdtempSync(join(tmpdir(), 'retail-kiosk-workspace-'));
    const localBackendDir = join(root, 'services/local-backend');
    const adminDistDir = join(root, 'apps/admin-dashboard/dist-web');
    mkdirSync(join(adminDistDir, 'assets'), { recursive: true });
    mkdirSync(localBackendDir, { recursive: true });
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n  - services/*\n');
    writeFileSync(join(adminDistDir, 'index.html'), '<!doctype html><div id="admin-root">admin dashboard</div>');
    writeFileSync(join(adminDistDir, 'assets/admin-smoke.js'), 'console.log("admin smoke");');

    process.chdir(localBackendDir);
    try {
      const config = localBackendConfigFromEnv({});
      assert.equal(config.adminStaticDir, adminDistDir);
      assert.equal(config.playerStaticDir, join(root, 'apps/kiosk-player/dist'));

      const { app, auth } = await testServer({ ...config, port: 8787 });
      try {
        const admin = await app.inject({ method: 'GET', url: '/admin', headers: auth });
        assert.equal(admin.statusCode, 200);
        assert.match(admin.body, /admin dashboard/);
        assert.match(admin.headers['content-type'], /^text\/html/);

        const asset = await app.inject({ method: 'GET', url: '/admin/assets/admin-smoke.js', headers: auth });
        assert.equal(asset.statusCode, 200);
        assert.match(asset.body, /admin smoke/);
        assert.match(asset.headers['content-type'], /^text\/javascript/);
      } finally {
        await app.close();
      }
    } finally {
      process.chdir(originalCwd);
    }
  });
});

function campaignRuntimePayload() {
  return {
    campaign_short_code: 'DOW',
    quiz: {
      question: { 'fr-BE': 'Question FR?', 'nl-BE': 'Vraag NL?' },
      choices: [
        { choice_id: 'right', label: { 'fr-BE': 'Oui', 'nl-BE': 'Ja' }, correct: true },
        { choice_id: 'wrong-a', label: { 'fr-BE': 'Non', 'nl-BE': 'Nee' }, correct: false },
        { choice_id: 'wrong-b', label: { 'fr-BE': 'Peut-être', 'nl-BE': 'Misschien' }, correct: false },
      ],
      attempt_limit: 2,
    },
    bitmap_assets: [{ asset_id: 'ticket-bitmap', path: 'assets/tickets/ticket-bitmap.txt' }],
    ticket_templates: [{ template_id: 'voucher-v1', path: 'ticket-template/voucher.txt', bitmap_asset_id: 'ticket-bitmap' }],
    outcome_strategy: {
      authority: 'local_backend',
      offline_required: true,
      selection: 'weighted_random',
      outcomes: [{
        outcome_id: 'standard-discount',
        outcome_type: 'win',
        active: true,
        localized_label: { 'fr-BE': 'Réduction pizza standard', 'nl-BE': 'Standaard pizzakorting' },
        weight: 1,
        print_ticket: true,
        ticket_template_id: 'voucher-v1',
        bitmap_asset_id: 'ticket-bitmap',
        qr_payload_template: 'https://promo.example.test/r/{{ticket_code}}',
        cashier_instruction: { 'fr-BE': 'Scannez ce ticket FR', 'nl-BE': 'Scan dit ticket NL' },
        terms: { 'fr-BE': 'Valable en Belgique FR', 'nl-BE': 'Geldig in België NL' },
      }],
    },
    visual_wheel: {
      segments: [{ segment_id: 'slice-standard-discount', outcome_id: 'standard-discount', bitmap_asset_id: 'ticket-bitmap', localized_label: { 'fr-BE': 'Réduction standard', 'nl-BE': 'Standaard korting' } }],
    },
  };
}

function seedActiveCampaign(runtime, payload = campaignRuntimePayload()) {
  const now = new Date().toISOString();
  runtime.db.prepare(`INSERT INTO schedules (schedule_id, status, timezone, activation_mode, package_id, package_version, module_id, module_version, validation_status, cache_status, created_at, updated_at)
    VALUES ('campaign-runtime', 'draft', 'Europe/Brussels', 'scheduled', 'dr-oetker-pizza-wheel', '1.0.0', 'pizza-wheel', '1.0.0', 'valid', 'cached', ?, ?)`).run(now, now);
  runtime.db.prepare(`INSERT INTO schedule_slots (slot_id, schedule_id, position, starts_at, ends_at, package_id, package_version, module_id, module_version, cache_status, payload)
    VALUES ('campaign-runtime-primary', 'campaign-runtime', 0, '2000-01-01T00:00:00.000Z', '2999-01-01T00:00:00.000Z', 'dr-oetker-pizza-wheel', '1.0.0', 'pizza-wheel', '1.0.0', 'cached', ?)`).run(JSON.stringify(payload));
  runtime.db.prepare("UPDATE runtime_state SET schedule_version = 'campaign-runtime', active_package_id = 'dr-oetker-pizza-wheel', active_package_version = '1.0.0' WHERE id = 1").run();
}

function validScheduleDraft(overrides = {}) {
  return {
    timezone: 'Europe/Brussels',
    activation_mode: 'scheduled',
    package_id: 'chocomel-wheel',
    package_version: '1.0.0',
    module_id: 'wheel-v1',
    module_version: '2026.06.13',
    validation_status: 'valid',
    cache_status: 'cached',
    slots: [{
      starts_at: '2026-06-14T10:00:00.000Z',
      ends_at: '2026-06-14T12:00:00.000Z',
      package_id: 'chocomel-wheel',
      package_version: '1.0.0',
      module_id: 'wheel-v1',
      module_version: '2026.06.13',
      cache_status: 'cached',
      payload: { sequence: ['intro', 'wheel', 'ticket'] },
    }],
    ...overrides,
  };
}

describe('local backend fake hardware API', () => {
  it('exports fake adapters with health snapshots', () => {
    assert.equal(new FakeTokenAdapter().health().status, 'online');
    assert.equal(new FakePrinterAdapter().health().fake, true);
  });

  it('parses real hardware adapter config from environment', () => {
    const config = localBackendConfigFromEnv({
      LOCAL_BACKEND_HARDWARE_MODE: 'real',
      SERIAL_TOKEN_PORT: '/dev/ttyUSB9',
      SERIAL_TOKEN_BAUD: '19200',
      SERIAL_TOKEN_DEBOUNCE_MS: '750',
      SERIAL_TOKEN_RECONNECT_MS: '3000',
      CUPS_PRINTER_NAME: 'PT80KM',
    });
    assert.equal(config.hardwareMode, 'real');
    assert.equal(config.serialTokenPort, '/dev/ttyUSB9');
    assert.equal(config.serialTokenBaudRate, 19200);
    assert.equal(config.serialTokenDebounceMs, 750);
    assert.equal(config.serialTokenReconnectMs, 3000);
    assert.equal(config.cupsPrinterName, 'PT80KM');
  });

  it('selects real serial and CUPS adapters when hardware mode is real', () => {
    const runtime = createLocalBackendRuntime({
      config: {
        hardwareMode: 'real',
        serialTokenPort: '/dev/ttyUSB9',
        serialTokenBaudRate: 19200,
        serialTokenDebounceMs: 750,
        serialTokenReconnectMs: 3000,
        cupsPrinterName: 'PT80KM',
      },
    });
    assert.equal(runtime.tokenAdapter.health().adapter, 'SerialTokenAdapter');
    assert.equal(runtime.printerAdapter.health().adapter, 'CupsPrinterAdapter');
  });

  it('normalizes serial token chunks conservatively and debounces duplicates', () => {
    const adapter = new SerialTokenAdapter({ port: '/dev/ttyUSB0', baudRate: 9600, debounceMs: 500, reconnectMs: 1000 });
    const first = adapter.ingestForTest(Buffer.from([0x01, 0x02]), 1_000);
    assert.equal(first.source, 'serial');
    assert.equal(first.denomination_cents, 0);
    assert.equal(first.payload.raw_hex, '0102');
    assert.equal(first.payload.normalized_value, '0102');
    assert.equal(first.payload.denomination_mapping, 'unmapped_o0_no_token_pulse_evidence');
    assert.equal(adapter.ingestForTest(Buffer.from([0x01, 0x02]), 1_100), null);
    assert.ok(adapter.ingestForTest(Buffer.from([0x01, 0x02]), 1_600));
  });

  it('records serial token detections before starting the session', async () => {
    let tokenCallback;
    const tokenAdapter = {
      adapter: 'TestSerialTokenAdapter',
      fake: false,
      health: () => ({ adapter: 'TestSerialTokenAdapter', status: 'online', fake: false }),
      onToken: (callback) => { tokenCallback = callback; },
    };
    const { app, runtime } = await testServer({ packageId: 'dr-oetker-pizza-wheel', packageVersion: '1.0.0' }, { tokenAdapter, printerAdapter: new FakePrinterAdapter() });
    seedActiveCampaign(runtime);
    try {
      tokenCallback({ token_id: 'serial-token-1', source: 'serial', denomination_cents: 0, occurred_at: new Date().toISOString(), payload: { raw_hex: '01' } });
      const serialEvent = runtime.db.prepare("select payload from events where event_type = 'serial_token_detected'").get();
      const receivedEvent = runtime.db.prepare("select payload from events where event_type = 'token_received'").get();
      assert.ok(serialEvent);
      assert.match(serialEvent.payload, /serial-token-1/);
      assert.ok(receivedEvent);
    } finally {
      await app.close();
    }
  });

  it('submits CUPS print jobs through lp with injected command runner', async () => {
    const { db } = testServerDb();
    const ticket = seedTicket(db);
    const commands = [];
    const adapter = new CupsPrinterAdapter({ printerName: 'ICOD-PT80KM' }, async (command, args) => {
      commands.push({ command, args });
      return { code: 0, stdout: 'request accepted', stderr: '' };
    });
    const result = await adapter.printTicket(db, ticket, { prize: 'sample' });
    assert.equal(result.status, 'print_submitted');
    assert.equal(result.fake, false);
    assert.equal(result.printer_name, 'ICOD-PT80KM');
    assert.equal(result.cups_job_id, undefined);
    assert.equal(commands[0].command, 'lp');
    assert.deepEqual(commands[0].args.slice(0, 4), ['-d', 'ICOD-PT80KM', '-t', `retail-kiosk-${ticket.ticket_id}`]);
    const ticketRow = db.prepare('select print_status, printed_at from tickets where ticket_id = ?').get(ticket.ticket_id);
    assert.equal(ticketRow.print_status, 'printing');
    assert.equal(ticketRow.printed_at, null);
    const jobRow = db.prepare('select status, completed_at, result_payload from print_jobs where ticket_id = ?').get(ticket.ticket_id);
    assert.equal(jobRow.status, 'submitted');
    assert.equal(jobRow.completed_at, null);
    assert.equal(JSON.parse(jobRow.result_payload).status, 'print_submitted');
    assert.ok(db.prepare("select event_type from events where event_type = 'cups_print_submitted'").get());
  });

  it('marks CUPS print jobs printed when the queue clears', async () => {
    const { db } = testServerDb();
    const ticket = seedTicket(db);
    let lpstatCalls = 0;
    const adapter = new CupsPrinterAdapter({ printerName: 'ICOD-PT80KM' }, async (command) => {
      if (command === 'lp') return { code: 0, stdout: 'request id is ICOD-PT80KM-30 (1 file(s))', stderr: '' };
      lpstatCalls += 1;
      return { code: 0, stdout: '', stderr: '' };
    });
    const result = await adapter.printTicket(db, ticket, { prize: 'sample' });
    assert.equal(result.status, 'printed');
    assert.equal(result.cups_job_id, 'ICOD-PT80KM-30');
    assert.equal(lpstatCalls, 1);
    const ticketRow = db.prepare('select print_status, printed_at from tickets where ticket_id = ?').get(ticket.ticket_id);
    assert.equal(ticketRow.print_status, 'printed');
    assert.ok(ticketRow.printed_at);
    const jobRow = db.prepare('select status, completed_at, result_payload from print_jobs where ticket_id = ?').get(ticket.ticket_id);
    assert.equal(jobRow.status, 'printed');
    assert.ok(jobRow.completed_at);
    assert.equal(JSON.parse(jobRow.result_payload).status, 'printed');
    assert.ok(db.prepare("select event_type from events where event_type = 'cups_print_completed'").get());
  });

  it('records CUPS print failures without requiring a printer in tests', async () => {
    const { db } = testServerDb();
    const ticket = seedTicket(db);
    const adapter = new CupsPrinterAdapter({ printerName: 'missing-printer' }, async () => ({ code: 1, stdout: '', stderr: 'printer not found' }));
    const result = await adapter.printTicket(db, ticket);
    assert.equal(result.status, 'print_failed');
    assert.equal(result.error_message, 'printer not found');
    assert.equal(adapter.health().status, 'degraded');
    assert.equal(db.prepare('select print_status from tickets where ticket_id = ?').get(ticket.ticket_id).print_status, 'print_failed');
    assert.ok(db.prepare("select event_type from events where event_type = 'cups_print_failed'").get());
  });

  it('reports real hardware mode in health without claiming fake hardware', async () => {
    const { app, auth } = await testServer({ hardwareMode: 'real' });
    try {
      const response = await app.inject({ method: 'GET', url: '/health', headers: auth });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().fake_hardware, false);
      assert.equal(response.json().hardware_mode, 'real');
      assert.equal(response.json().adapters.token.adapter, 'SerialTokenAdapter');
      assert.equal(response.json().adapters.printer.adapter, 'CupsPrinterAdapter');
    } finally {
      await app.close();
    }
  });

  it('protects local API with auth token and origin when configured', async () => {
    const { app, auth } = await testServer();
    try {
      const unauthorized = await app.inject({ method: 'GET', url: '/state', headers: { origin: auth.origin } });
      assert.equal(unauthorized.statusCode, 401);

      const forbidden = await app.inject({ method: 'GET', url: '/state', headers: { authorization: auth.authorization, origin: 'https://evil.example' } });
      assert.equal(forbidden.statusCode, 403);

      const ok = await app.inject({ method: 'GET', url: '/health', headers: auth });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.json().status, 'ok');
    } finally {
      await app.close();
    }
  });

  it('serves CORS preflight for allowed player origins without requiring auth', async () => {
    const { app, auth } = await testServer();
    try {
      const response = await app.inject({ method: 'OPTIONS', url: '/dev/token', headers: { origin: auth.origin, 'access-control-request-method': 'POST' } });
      assert.equal(response.statusCode, 204);
      assert.equal(response.headers['access-control-allow-origin'], auth.origin);
      const forbidden = await app.inject({ method: 'OPTIONS', url: '/dev/token', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
      assert.equal(forbidden.statusCode, 403);
    } finally {
      await app.close();
    }
  });

  it('hides dev token route unless explicitly enabled', async () => {
    const { app, auth } = await testServer({ devRoutesEnabled: false });
    try {
      const response = await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      assert.equal(response.statusCode, 404);
      assert.equal(response.json().error, 'dev_routes_disabled');
    } finally {
      await app.close();
    }
  });

  it('serves the built kiosk player under /player from the configured static directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'retail-kiosk-player-'));
    const playerDir = join(dir, 'dist');
    mkdirSync(playerDir, { recursive: true });
    writeFileSync(join(playerDir, 'index.html'), '<!doctype html><title>Kiosk Player</title>', 'utf8');
    writeFileSync(join(playerDir, 'app.js'), 'console.log("player")', 'utf8');
    const { app, auth } = await testServer({ playerStaticDir: playerDir });
    try {
      const index = await app.inject({ method: 'GET', url: '/player', headers: auth });
      assert.equal(index.statusCode, 200);
      assert.match(index.body, /Kiosk Player/);
      assert.equal(index.headers['cache-control'], 'no-store');

      const asset = await app.inject({ method: 'GET', url: '/player/app.js', headers: auth });
      assert.equal(asset.statusCode, 200);
      assert.equal(asset.headers['content-type'], 'text/javascript; charset=utf-8');
      assert.match(asset.body, /player/);
    } finally {
      await app.close();
    }
  });

  it('runs fake token to session to ticket to fake print to reset flow', async () => {
    const { app, runtime, auth } = await testServer();
    try {
      const token = await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      assert.equal(token.statusCode, 201);
      assert.equal(token.json().session.state, 'playing');

      const printed = await app.inject({ method: 'POST', url: '/print/test', headers: auth, payload: { render_payload: { prize: 'sample' } } });
      assert.equal(printed.statusCode, 200);
      const body = printed.json();
      assert.match(body.ticket.ticket_code, /^CHO-HQ001-[0-9A-HJKMNP-TV-Z]{12}-[0-9A-HJKMNP-TV-Z]{6}$/);
      assert.equal(body.print.status, 'printed');
      assert.equal(body.session.state, 'idle');
      assert.equal(body.state.runtime.mode, 'idle');
      assert.equal(runtime.db.prepare('select count(*) as count from print_jobs').get().count, 1);
      assert.equal(runtime.db.prepare("select print_status from tickets limit 1").get().print_status, 'printed');
      assert.ok(runtime.db.prepare("select event_type from events where event_type = 'fake_print_completed'").get());
      runtime.db.prepare(`INSERT INTO schedules (schedule_id, status, timezone, activation_mode, package_id, package_version, module_id, module_version, validation_status, cache_status, created_at, updated_at)
        VALUES ('current', 'draft', 'UTC', 'scheduled', 'chocomel-wheel', '1.0.0', 'wheel-v1', '2026.06.13', 'valid', 'cached', ?, ?)`).run(new Date().toISOString(), new Date().toISOString());
      runtime.db.prepare(`INSERT INTO schedule_slots (slot_id, schedule_id, position, starts_at, ends_at, package_id, package_version, module_id, module_version, cache_status, payload)
        VALUES ('current-primary', 'current', 0, '2000-01-01T00:00:00.000Z', '2999-01-01T00:00:00.000Z', 'chocomel-wheel', '1.0.0', 'wheel-v1', '2026.06.13', 'cached', '{}')`).run();

      const runs = await app.inject({ method: 'GET', url: '/admin/api/game-runs', headers: auth });
      assert.equal(runs.statusCode, 200);
      const [run] = runs.json().runs;
      assert.equal(run.session_id, body.ticket.session_id);
      assert.equal(run.package_id, 'chocomel-wheel');
      assert.equal(run.package_version, '1.0.0');
      assert.equal(run.module_id, 'wheel-v1');
      assert.equal(run.module_version, '2026.06.13');
      assert.equal(run.state, 'idle');
      assert.equal(run.token_event.source, 'fake');
      assert.equal(run.token_event.denomination_cents, 100);
      assert.equal(run.prize, 'sample');
      assert.equal(run.ticket_code, body.ticket.ticket_code);
      assert.equal(run.print_status, 'printed');
      assert.equal(run.error, null);
      assert.ok(run.duration_ms >= 0);
      assert.ok(run.ended_at);
    } finally {
      await app.close();
    }
  });


  it('keeps quiz language locked and resets without reward after two wrong answers', async () => {
    const { app, runtime, auth } = await testServer({ packageId: 'dr-oetker-pizza-wheel', packageVersion: '1.0.0', campaignShortCode: 'DOW' });
    seedActiveCampaign(runtime);
    try {
      await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      const first = await app.inject({ method: 'POST', url: '/quiz/answer', headers: auth, payload: { language: 'fr-BE', choice_id: 'wrong-a' } });
      assert.equal(first.statusCode, 200);
      assert.equal(first.json().quiz.retry, true);
      assert.equal(first.json().state.current_session.session_language, 'fr-BE');
      const second = await app.inject({ method: 'POST', url: '/quiz/answer', headers: auth, payload: { language: 'nl-BE', choice_id: 'wrong-b' } });
      assert.equal(second.statusCode, 200);
      assert.equal(second.json().state.runtime.mode, 'idle');
      assert.equal(second.json().state.current_session, null);
      assert.equal(runtime.db.prepare('select count(*) as count from tickets').get().count, 0);
      assert.equal(runtime.db.prepare('select session_language from sessions limit 1').get().session_language, 'fr-BE');
      assert.ok(runtime.db.prepare("select event_type from events where event_type = 'session_completed_no_reward'").get());
    } finally {
      await app.close();
    }
  });

  it('rejects spin after the first wrong quiz answer without selecting an outcome', async () => {
    const { app, runtime, auth } = await testServer({ packageId: 'dr-oetker-pizza-wheel', packageVersion: '1.0.0', campaignShortCode: 'DOW' });
    seedActiveCampaign(runtime);
    try {
      await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      const first = await app.inject({ method: 'POST', url: '/quiz/answer', headers: auth, payload: { language: 'fr-BE', choice_id: 'wrong-a' } });
      assert.equal(first.statusCode, 200);
      assert.equal(first.json().quiz.retry, true);
      assert.equal(first.json().state.current_session.session_language, 'fr-BE');
      assert.equal(first.json().state.current_session.quiz_passed, false);

      const spin = await app.inject({ method: 'POST', url: '/spin/start', headers: auth, payload: {} });
      assert.equal(spin.statusCode, 409);
      assert.equal(spin.json().error, 'quiz_not_passed');
      assert.equal(runtime.db.prepare('select count(*) as count from tickets').get().count, 0);
      assert.equal(runtime.db.prepare("select count(*) as count from events where event_type = 'outcome_selected'").get().count, 0);
      assert.equal(runtime.db.prepare("select count(*) as count from events where event_type = 'spin_started'").get().count, 0);
    } finally {
      await app.close();
    }
  });

  it('uses FR and NL session language in backend-selected outcome ticket render payloads', async () => {
    const { app, runtime, auth } = await testServer({ packageId: 'dr-oetker-pizza-wheel', packageVersion: '1.0.0', campaignShortCode: 'DOW' });
    seedActiveCampaign(runtime);
    try {
      for (const language of ['fr-BE', 'nl-BE']) {
        await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100, language } });
        const answer = await app.inject({ method: 'POST', url: '/quiz/answer', headers: auth, payload: { language, choice_id: 'right' } });
        assert.equal(answer.statusCode, 200);
        assert.equal(answer.json().state.current_session.quiz_passed, true);
        const spin = await app.inject({ method: 'POST', url: '/spin/start', headers: auth, payload: {} });
        assert.equal(spin.statusCode, 200);
        assert.equal(spin.json().session.state, 'result_pending');
        assert.equal(runtime.db.prepare('select count(*) as count from tickets').get().count, language === 'fr-BE' ? 0 : 1);
        const complete = await app.inject({ method: 'POST', url: '/spin/complete', headers: auth, payload: {} });
        assert.equal(complete.statusCode, 200);
        const body = complete.json();
        assert.equal(body.ticket.render_payload.language, language);
        assert.equal(body.ticket.render_payload.ticket_template_id, 'voucher-v1');
        assert.equal(body.ticket.render_payload.bitmap_asset_id, 'ticket-bitmap');
        assert.equal(body.ticket.render_payload.qr_payload, `https://promo.example.test/r/${body.ticket.ticket_code}`);
        assert.equal(body.ticket.render_payload.cashier_instruction, language === 'fr-BE' ? 'Scannez ce ticket FR' : 'Scan dit ticket NL');
        assert.equal(body.ticket.render_payload.campaign_name, 'Dr. Oetker Pizza Wheel');
        assert.equal(body.ticket.render_payload.product_name, 'Dr. Oetker Ristorante pizza');
        assert.equal(body.ticket.render_payload.reward_value, '€1.00');
        assert.equal(body.ticket.render_payload.reward_label, language === 'fr-BE' ? '1 € de réduction sur une pizza Dr. Oetker Ristorante' : '€1 korting op een Dr. Oetker Ristorante pizza');
      }
      assert.equal(runtime.db.prepare('select count(*) as count from tickets').get().count, 2);
      assert.equal(runtime.db.prepare("select count(*) as count from events where event_type = 'outcome_selected'").get().count, 2);
    } finally {
      await app.close();
    }
  });

  it('skips capped weighted outcomes at spin start', async () => {
    const cappedCampaign = structuredClone(campaignRuntimePayload());
    const baseOutcome = cappedCampaign.outcome_strategy.outcomes[0];
    cappedCampaign.outcome_strategy.outcomes = [
      { ...baseOutcome, outcome_id: 'free-pizza', weight: 999, inventory_cap: 1 },
      { ...baseOutcome, outcome_id: 'slice-coupon', localized_label: { 'fr-BE': 'Part de pizza', 'nl-BE': 'Pizzapunt' }, weight: 1 },
    ];
    const { app, runtime, auth } = await testServer({ packageId: 'dr-oetker-pizza-wheel', packageVersion: '1.0.0', campaignShortCode: 'DOW' });
    seedActiveCampaign(runtime, cappedCampaign);
    appendEvent(runtime.db, { kioskId: 'HQ001', eventType: 'outcome_selected', payload: { outcome_id: 'free-pizza' } });
    try {
      await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      await app.inject({ method: 'POST', url: '/quiz/answer', headers: auth, payload: { language: 'fr-BE', choice_id: 'right' } });
      const spin = await app.inject({ method: 'POST', url: '/spin/start', headers: auth, payload: {} });
      assert.equal(spin.statusCode, 200);
      assert.equal(spin.json().outcome.outcome_id, 'slice-coupon');
      assert.equal(spin.json().session.state, 'result_pending');
      assert.equal(runtime.db.prepare('select count(*) as count from tickets').get().count, 0);
      const complete = await app.inject({ method: 'POST', url: '/spin/complete', headers: auth, payload: {} });
      assert.equal(complete.statusCode, 200);
      assert.equal(complete.json().outcome.outcome_id, 'slice-coupon');
      assert.equal(complete.json().ticket.render_payload.outcome_id, 'slice-coupon');
    } finally {
      await app.close();
    }
  });

  it('starts no-token sessions and lets operators reset active sessions', async () => {
    const { app, auth } = await testServer();
    try {
      const started = await app.inject({ method: 'POST', url: '/dev/session/start', headers: auth, payload: { source: 'admin-ui', trigger: 'no-token-campaign' } });
      assert.equal(started.statusCode, 201);
      assert.equal(started.json().session.state, 'playing');
      assert.equal(started.json().state.current_session.state, 'playing');

      const reset = await app.inject({ method: 'POST', url: '/session/reset', headers: auth, payload: { reason: 'test-reset' } });
      assert.equal(reset.statusCode, 200);
      assert.equal(reset.json().state.runtime.mode, 'idle');
      assert.equal(reset.json().state.current_session, null);
    } finally {
      await app.close();
    }
  });

  it('keeps print failures visible as degraded_printer in print test flow', async () => {
    const printerAdapter = new CupsPrinterAdapter({ printerName: 'missing-printer' }, async () => ({ code: 1, stdout: '', stderr: 'printer not found' }));
    const { app, runtime, auth } = await testServer({}, { printerAdapter });
    try {
      const token = await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      assert.equal(token.statusCode, 201);
      assert.equal(token.json().session.state, 'playing');

      const printed = await app.inject({ method: 'POST', url: '/print/test', headers: auth, payload: { render_payload: { prize: 'sample' } } });
      assert.equal(printed.statusCode, 200);
      const body = printed.json();
      assert.equal(body.print.status, 'print_failed');
      assert.equal(body.print.error_message, 'printer not found');
      assert.equal(body.session.state, 'degraded_printer');
      assert.equal(body.session.last_error, 'printer not found');
      assert.equal(body.state.runtime.mode, 'degraded_printer');
      assert.equal(body.state.runtime.last_error, 'printer not found');
      assert.equal(body.state.current_session.state, 'degraded_printer');
      const ticketRow = runtime.db.prepare('select print_status, printed_at from tickets where ticket_id = ?').get(body.ticket.ticket_id);
      assert.equal(ticketRow.print_status, 'print_failed');
      assert.equal(ticketRow.printed_at, null);
    } finally {
      await app.close();
    }
  });

  it('enters and exits maintenance mode', async () => {
    const { app, auth } = await testServer();
    try {
      const entered = await app.inject({ method: 'POST', url: '/maintenance/enter', headers: auth });
      assert.equal(entered.statusCode, 200);
      assert.equal(entered.json().state.runtime.mode, 'maintenance');

      const exited = await app.inject({ method: 'POST', url: '/maintenance/exit', headers: auth });
      assert.equal(exited.statusCode, 200);
      assert.equal(exited.json().state.runtime.mode, 'idle');
    } finally {
      await app.close();
    }
  });

  it('serves websocket state and broadcasts API state changes', async () => {
    const { app, auth } = await testServer({ port: 0, allowedOrigins: [] });
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const address = app.server.address();
      assert.equal(typeof address, 'object');
      const port = address.port;
      const messages = [];
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=test-token`);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', reject, { once: true });
      });
      ws.addEventListener('message', (event) => messages.push(JSON.parse(event.data)));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      ws.close();
      assert.ok(messages.some((message) => message.type === 'state' && message.state.runtime.mode === 'playing'));
    } finally {
      await app.close();
    }
  });

  it('creates, lists, reads, and audits local draft schedules', async () => {
    const { app, runtime, auth } = await testServer();
    try {
      const put = await app.inject({ method: 'PUT', url: '/schedules/morning/draft', headers: auth, payload: validScheduleDraft() });
      assert.equal(put.statusCode, 200);
      const schedule = put.json().schedule;
      assert.equal(schedule.schedule_id, 'morning');
      assert.equal(schedule.timezone, 'Europe/Brussels');
      assert.equal(schedule.activation_mode, 'scheduled');
      assert.equal(schedule.package_id, 'chocomel-wheel');
      assert.equal(schedule.module_id, 'wheel-v1');
      assert.equal(schedule.validation_status, 'valid');
      assert.equal(schedule.cache_status, 'cached');
      assert.equal(schedule.slots.length, 1);
      assert.deepEqual(schedule.slots[0].payload.sequence, ['intro', 'wheel', 'ticket']);

      const list = await app.inject({ method: 'GET', url: '/schedules', headers: auth });
      assert.equal(list.statusCode, 200);
      assert.equal(list.json().schedules.length, 1);

      const read = await app.inject({ method: 'GET', url: '/schedules/morning', headers: auth });
      assert.equal(read.statusCode, 200);
      assert.equal(read.json().schedule.schedule_id, 'morning');
      assert.equal(runtime.db.prepare("select count(*) as count from schedule_audit_events where action = 'draft_schedule_created'").get().count, 1);
      assert.ok(runtime.db.prepare("select event_type from events where event_type = 'draft_schedule_created'").get());
    } finally {
      await app.close();
    }
  });

  it('serves scheduler APIs in real hardware mode', async () => {
    const { app, auth } = await testServer({ hardwareMode: 'real' });
    try {
      const put = await app.inject({ method: 'PUT', url: '/schedules/real-mode/draft', headers: auth, payload: validScheduleDraft() });
      assert.equal(put.statusCode, 200);

      const list = await app.inject({ method: 'GET', url: '/schedules', headers: auth });
      assert.equal(list.statusCode, 200);
      assert.equal(list.json().schedules.length, 1);

      const read = await app.inject({ method: 'GET', url: '/schedules/real-mode', headers: auth });
      assert.equal(read.statusCode, 200);
      assert.equal(read.json().schedule.schedule_id, 'real-mode');
    } finally {
      await app.close();
    }
  });

  it('returns validation errors for invalid schedule drafts', async () => {
    const { app, auth } = await testServer();
    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/schedules/bad/draft',
        headers: auth,
        payload: { activation_mode: 'scheduled', package_id: '', slots: [] },
      });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error, 'schedule_validation_failed');
      assert.ok(response.json().details.some((detail) => detail.includes('package_id')));
      assert.ok(response.json().details.some((detail) => detail.includes('slots')));
    } finally {
      await app.close();
    }
  });

  it('persists schedules across backend restart and keeps previous known good draft', async () => {
    const { db, dir } = testServerDb();
    const dbPath = join(dir, 'runtime.sqlite');
    db.close();

    const firstDb = openLocalDatabase(dbPath);
    migrateDatabase(firstDb);
    const firstRuntime = createLocalBackendRuntime({ db: firstDb, config: { devRoutesEnabled: true, authToken: 'test-token' } });
    const firstApp = await createLocalBackendServer(firstRuntime);
    const auth = { authorization: 'Bearer test-token' };
    try {
      const created = await firstApp.inject({ method: 'PUT', url: '/schedules/restart/draft', headers: auth, payload: validScheduleDraft() });
      assert.equal(created.statusCode, 200);
      const updated = await firstApp.inject({
        method: 'PUT',
        url: '/schedules/restart/draft',
        headers: auth,
        payload: validScheduleDraft({ validation_status: 'draft', cache_status: 'pending', module_version: '2026.06.14' }),
      });
      assert.equal(updated.statusCode, 200);
      assert.equal(updated.json().schedule.previous_known_good_schedule.validation_status, 'valid');
      assert.equal(updated.json().schedule.previous_known_good_schedule.module_version, '2026.06.13');
    } finally {
      await firstApp.close();
      firstDb.close();
    }

    const secondDb = openLocalDatabase(dbPath);
    migrateDatabase(secondDb);
    const secondRuntime = createLocalBackendRuntime({ db: secondDb, config: { devRoutesEnabled: true, authToken: 'test-token' } });
    const secondApp = await createLocalBackendServer(secondRuntime);
    try {
      const read = await secondApp.inject({ method: 'GET', url: '/schedules/restart', headers: auth });
      assert.equal(read.statusCode, 200);
      assert.equal(read.json().schedule.module_version, '2026.06.14');
      assert.equal(read.json().schedule.previous_known_good_schedule.module_version, '2026.06.13');
    } finally {
      await secondApp.close();
      secondDb.close();
    }
  });

  it('stages next-safe-boundary schedules during an active session and activates after reset', async () => {
    const { app, runtime, auth } = await testServer();
    try {
      const current = await app.inject({
        method: 'PUT',
        url: '/schedules/current/draft',
        headers: auth,
        payload: validScheduleDraft({ activation_mode: 'next-safe-boundary', module_id: 'wheel-v1', module_version: '2026.06.13' }),
      });
      assert.equal(current.statusCode, 200);
      assert.equal(current.json().state.runtime.active_package_id, 'chocomel-wheel');
      assert.equal(current.json().state.scheduler.active_schedule.schedule_id, 'current');

      const token = await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 100 } });
      assert.equal(token.statusCode, 201);
      assert.equal(token.json().session.state, 'playing');
      assert.equal(token.json().session.package_id, 'chocomel-wheel');

      const staged = await app.inject({
        method: 'PUT',
        url: '/schedules/afternoon/draft',
        headers: auth,
        payload: validScheduleDraft({
          activation_mode: 'next-safe-boundary',
          package_id: 'chocomel-bonus',
          package_version: '2.0.0',
          module_id: 'bonus-wheel',
          module_version: '2026.06.14',
          slots: [{
            starts_at: '2026-06-14T10:00:00.000Z',
            ends_at: '2026-06-14T12:00:00.000Z',
            package_id: 'chocomel-bonus',
            package_version: '2.0.0',
            module_id: 'bonus-wheel',
            module_version: '2026.06.14',
            cache_status: 'cached',
            payload: { sequence: ['intro', 'bonus-wheel', 'ticket'] },
          }],
        }),
      });
      assert.equal(staged.statusCode, 200);
      assert.equal(staged.json().schedule.schedule_id, 'afternoon');
      assert.equal(staged.json().state.runtime.active_package_id, 'chocomel-wheel');
      assert.equal(staged.json().state.current_session.package_id, 'chocomel-wheel');
      assert.equal(staged.json().state.scheduler.active_schedule.schedule_id, 'current');
      assert.equal(staged.json().state.scheduler.pending_schedule.schedule_id, 'afternoon');
      assert.equal(staged.json().state.scheduler.next_module.module_id, 'bonus-wheel');

      const printed = await app.inject({ method: 'POST', url: '/print/test', headers: auth, payload: { render_payload: { prize: 'sample' } } });
      assert.equal(printed.statusCode, 200);
      const afterReset = printed.json();
      assert.equal(afterReset.session.state, 'idle');
      assert.equal(afterReset.state.runtime.active_package_id, 'chocomel-bonus');
      assert.equal(afterReset.state.scheduler.active_schedule.schedule_id, 'afternoon');
      assert.equal(afterReset.state.scheduler.pending_schedule, null);
      assert.equal(afterReset.state.scheduler.current_module.module_id, 'bonus-wheel');
      assert.equal(runtime.db.prepare("select count(*) as count from schedule_audit_events where action = 'schedule_activated_at_safe_boundary' and schedule_id = 'afternoon'").get().count, 1);
      assert.ok(runtime.db.prepare("select event_type from events where event_type = 'schedule_activated_at_safe_boundary'").get());

      const nextToken = await app.inject({ method: 'POST', url: '/dev/token', headers: auth, payload: { denomination_cents: 200 } });
      assert.equal(nextToken.statusCode, 201);
      assert.equal(nextToken.json().session.package_id, 'chocomel-bonus');
      assert.equal(nextToken.json().session.package_version, '2.0.0');
    } finally {
      await app.close();
    }
  });
});
