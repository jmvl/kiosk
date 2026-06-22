import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCentralApiServer, InMemoryCentralRepository, recordHeartbeat, ingestEventBatch } from '../dist/index.js';

function heartbeat(overrides = {}) {
  return {
    kiosk_id: 'kiosk-hq-001',
    location_id: 'hq',
    agent_version: '0.0.1',
    runtime_version: '0.0.1',
    player_version: '0.0.1',
    active_package: 'chocomel-wheel@1.0.0',
    schedule_version: 7,
    uptime_seconds: 123,
    queue_length: 2,
    printer_status: 'healthy',
    token_status: 'healthy',
    runtime_health: 'healthy',
    player_health: 'healthy',
    last_session_at: '2026-06-12T12:00:00.000Z',
    last_error: null,
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    event_id: 'evt-001',
    kiosk_id: 'kiosk-hq-001',
    session_id: 'sess-001',
    local_sequence: 1,
    event_type: 'session_started',
    occurred_at: '2026-06-12T12:00:01.000Z',
    payload: { source: 'test' },
    schema_version: 1,
    ...overrides,
  };
}

describe('@retail-kiosk/central-api', () => {
  it('stores heartbeat payloads', async () => {
    const repository = new InMemoryCentralRepository();
    const response = await recordHeartbeat(repository, heartbeat());
    assert.equal(response.ok, true);
    assert.equal(response.heartbeat.kiosk_id, 'kiosk-hq-001');
    assert.equal(repository.heartbeats.size, 1);
    assert.equal([...repository.heartbeats.values()][0].payload.queue_length, 2);
  });

  it('ingests duplicate event uploads idempotently', async () => {
    const repository = new InMemoryCentralRepository();
    const payload = { kiosk_id: 'kiosk-hq-001', events: [event()] };

    const first = await ingestEventBatch(repository, payload);
    assert.equal(first.inserted_count, 1);
    assert.equal(first.duplicate_count, 0);

    const second = await ingestEventBatch(repository, payload);
    assert.equal(second.inserted_count, 0);
    assert.equal(second.duplicate_count, 1);
    assert.deepEqual(second.events, [{ event_id: 'evt-001', status: 'duplicate' }]);
    assert.equal(repository.events.size, 1);
  });

  it('exposes seeded heartbeats in admin fleet and kiosk read endpoints', async () => {
    const repository = new InMemoryCentralRepository();
    await repository.saveHeartbeat(heartbeat({ kiosk_id: 'kiosk-hq-001', queue_length: 5 }), new Date('2026-06-12T12:01:00.000Z'));

    const fleet = await repository.getFleetOverview(new Date('2026-06-12T12:02:00.000Z'));
    assert.equal(fleet.generated_at, '2026-06-12T12:02:00.000Z');
    assert.deepEqual(fleet.totals, { kiosks: 1, locations: 1, healthy: 1, degraded: 0, offline: 0, unknown: 0 });
    assert.equal(fleet.kiosks[0].kiosk_id, 'kiosk-hq-001');
    assert.equal(fleet.kiosks[0].last_heartbeat_at, '2026-06-12T12:01:00.000Z');
    assert.equal(fleet.kiosks[0].queue_length, 5);

    const kiosk = await repository.getKiosk('kiosk-hq-001');
    assert.equal(kiosk?.kiosk_id, 'kiosk-hq-001');
    assert.equal(kiosk?.last_heartbeat?.active_package, 'chocomel-wheel@1.0.0');
    assert.equal(kiosk?.last_heartbeat?.queue_length, 5);
  });

  it('serves admin fleet, kiosk detail, and empty control-plane reads over HTTP', async () => {
    const repository = new InMemoryCentralRepository();
    const server = createCentralApiServer(repository);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      assert.equal(typeof address, 'object');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const heartbeatResponse = await fetch(`${baseUrl}/v1/heartbeats`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(heartbeat({ queue_length: 3 })),
      });
      assert.equal(heartbeatResponse.status, 200);

      const fleetResponse = await fetch(`${baseUrl}/v1/admin/fleet/overview`);
      assert.equal(fleetResponse.status, 200);
      const fleetBody = await fleetResponse.json();
      assert.equal(fleetBody.ok, true);
      assert.equal(fleetBody.fleet.totals.kiosks, 1);
      assert.equal(fleetBody.fleet.kiosks[0].kiosk_id, 'kiosk-hq-001');
      assert.equal(fleetBody.fleet.kiosks[0].queue_length, 3);

      const kiosksResponse = await fetch(`${baseUrl}/v1/admin/kiosks`);
      assert.equal(kiosksResponse.status, 200);
      const kiosksBody = await kiosksResponse.json();
      assert.equal(kiosksBody.ok, true);
      assert.equal(kiosksBody.kiosks[0].kiosk_id, 'kiosk-hq-001');

      const kioskResponse = await fetch(`${baseUrl}/v1/admin/kiosks/kiosk-hq-001`);
      assert.equal(kioskResponse.status, 200);
      const kioskBody = await kioskResponse.json();
      assert.equal(kioskBody.ok, true);
      assert.equal(kioskBody.kiosk.kiosk_id, 'kiosk-hq-001');
      assert.equal(kioskBody.kiosk.last_heartbeat.queue_length, 3);

      const schedulesResponse = await fetch(`${baseUrl}/v1/admin/schedules`);
      assert.equal(schedulesResponse.status, 200);
      const schedulesBody = await schedulesResponse.json();
      assert.equal(schedulesBody.ok, true);
      assert.match(schedulesBody.generated_at, /^\d{4}-\d{2}-\d{2}T/);
      assert.deepEqual(schedulesBody.schedules, []);
      assert.deepEqual(schedulesBody.control_plane, {
        ready: false,
        source: 'central-control-plane',
        tables_available: false,
        message: 'central schedule tables are not available yet',
      });

      const deploymentsResponse = await fetch(`${baseUrl}/v1/admin/deployments`);
      assert.equal(deploymentsResponse.status, 200);
      const deploymentsBody = await deploymentsResponse.json();
      assert.equal(deploymentsBody.ok, true);
      assert.match(deploymentsBody.generated_at, /^\d{4}-\d{2}-\d{2}T/);
      assert.deepEqual(deploymentsBody.deployments, []);
      assert.deepEqual(deploymentsBody.control_plane, {
        ready: false,
        source: 'central-control-plane',
        tables_available: false,
        message: 'central deployment tables are not available yet',
      });

      const corsResponse = await fetch(`${baseUrl}/v1/admin/fleet/overview`, { headers: { origin: 'http://127.0.0.1:5173' } });
      assert.equal(corsResponse.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');

      const optionsResponse = await fetch(`${baseUrl}/v1/admin/fleet/overview`, { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:5173', 'access-control-request-method': 'GET' } });
      assert.equal(optionsResponse.status, 204);
      assert.equal(optionsResponse.headers.get('access-control-allow-methods'), 'GET,POST,PUT,OPTIONS');

      await fetch(`${baseUrl}/v1/events/batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kiosk_id: 'kiosk-hq-001', events: [event(), event({ event_id: 'evt-002', local_sequence: 2, event_type: 'ticket_printed', occurred_at: '2026-06-12T12:00:02.000Z' })] }),
      });
      const eventsResponse = await fetch(`${baseUrl}/v1/admin/events?limit=1&kiosk_id=kiosk-hq-001&event_type=ticket_printed`);
      assert.equal(eventsResponse.status, 200);
      const eventsBody = await eventsResponse.json();
      assert.equal(eventsBody.ok, true);
      assert.match(eventsBody.generated_at, /^\d{4}-\d{2}-\d{2}T/);
      assert.deepEqual(eventsBody.filters, { limit: 1, kiosk_id: 'kiosk-hq-001', event_type: 'ticket_printed' });
      assert.equal(eventsBody.rows.length, 1);
      assert.equal(eventsBody.rows[0].event_id, 'evt-002');
      assert.equal(eventsBody.rows[0].event_type, 'ticket_printed');
      assert.equal(eventsBody.rows[0].occurred_at, '2026-06-12T12:00:02.000Z');
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('keeps unsupported admin enqueue route explicit at the HTTP boundary', async () => {
    const server = createCentralApiServer(new InMemoryCentralRepository());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      assert.equal(typeof address, 'object');
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/admin/kiosks/kiosk-hq-001/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'test_print' }),
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
