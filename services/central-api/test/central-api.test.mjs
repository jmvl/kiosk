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
