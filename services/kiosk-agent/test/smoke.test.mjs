import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import packageJson from '../package.json' with { type: 'json' };
import {
  allowedAgentCommandTypes,
  createCommandExecutionState,
  loadKioskAgentConfig,
  runKioskAgentCycle,
  runKioskAgentDaemon,
} from '../dist/index.js';

function command(overrides = {}) {
  return {
    command_id: 'cmd_1',
    kiosk_id: 'hq-001',
    type: 'test_print',
    status: 'pending',
    payload: {},
    issued_at: '2026-06-12T00:00:00.000Z',
    expires_at: '2026-06-13T00:00:00.000Z',
    requires_confirmation: false,
    idempotency_key: 'idem_1',
    ...overrides,
  };
}

function config() {
  return loadKioskAgentConfig({
    env: {
      KIOSK_ID: 'hq-001',
      KIOSK_LOCATION_ID: 'hq',
      CENTRAL_API_BASE_URL: 'https://central.example.test/',
      KIOSK_AGENT_VERSION: '0.1.0',
      KIOSK_RUNTIME_VERSION: '0.1.0',
      KIOSK_PLAYER_VERSION: '0.1.0',
      KIOSK_ACTIVE_PACKAGE: 'chocomel-wheel@1.0.0',
      KIOSK_SCHEDULE_VERSION: '1',
    },
  });
}

class FakeClient {
  constructor(commands) {
    this.commands = commands;
    this.heartbeats = [];
    this.results = [];
  }

  async submitHeartbeat(payload) {
    this.heartbeats.push(payload);
  }

  async pollCommands(kioskId, limit) {
    this.polled = { kioskId, limit };
    return this.commands;
  }

  async reportCommandResult(result) {
    this.results.push(result);
  }
}

describe('@retail-kiosk/kiosk-agent skeleton', () => {
  it('declares the baseline scripts and shared dependency', () => {
    assert.equal(packageJson.name, '@retail-kiosk/kiosk-agent');
    assert.equal(packageJson.scripts.build, 'tsc -p tsconfig.build.json');
    assert.equal(packageJson.scripts.typecheck, 'tsc -p tsconfig.json --noEmit');
    assert.equal(packageJson.scripts.test, 'pnpm build && node --test test/*.test.mjs');
    assert.equal(packageJson.dependencies['@retail-kiosk/shared-types'], 'workspace:*');
  });

  it('accepts deployed env aliases from the systemd env template', () => {
    const loaded = loadKioskAgentConfig({
      env: {
        KIOSK_ID: 'hq-001',
        LOCATION_ID: 'hq',
        CENTRAL_API_URL: 'https://central.example.test/',
        HEARTBEAT_INTERVAL_SECONDS: '45',
      },
    });

    assert.equal(loaded.location_id, 'hq');
    assert.equal(loaded.central_api_base_url, 'https://central.example.test');
    assert.equal(loaded.poll_interval_ms, 45_000);
  });

  it('daemon runs repeated cycles until stopped instead of exiting after one cycle', async () => {
    const fakeClient = new FakeClient([]);
    const logs = [];
    await runKioskAgentDaemon({
      config: { ...config(), poll_interval_ms: 1 },
      client: fakeClient,
      state: createCommandExecutionState(),
      logger: { log: (message) => logs.push(message), error: (message) => logs.push(message) },
      maxCycles: 2,
    });

    assert.equal(fakeClient.heartbeats.length, 2);
    assert.equal(fakeClient.polled.kioskId, 'hq-001');
    assert.match(logs.at(0), /daemon started/);
    assert.match(logs.at(-1), /daemon stopped/);
  });

  it('builds heartbeat payload, polls commands, and reports allowlisted command result', async () => {
    const fakeClient = new FakeClient([command()]);
    const result = await runKioskAgentCycle({
      config: config(),
      client: fakeClient,
      state: createCommandExecutionState(),
      now: new Date('2026-06-12T12:00:00.000Z'),
    });

    assert.equal(fakeClient.heartbeats.length, 1);
    assert.equal(fakeClient.heartbeats[0].kiosk_id, 'hq-001');
    assert.equal(fakeClient.heartbeats[0].location_id, 'hq');
    assert.deepEqual(fakeClient.polled, { kioskId: 'hq-001', limit: 25 });
    assert.equal(result.commands_seen, 1);
    assert.equal(fakeClient.results.length, 3);
    assert.deepEqual(fakeClient.results.map((item) => item.status), ['accepted', 'running', 'succeeded']);
    assert.equal(fakeClient.results[0].command_id, 'cmd_1');
    assert.ok(fakeClient.results[0].accepted_at);
    assert.equal(fakeClient.results[0].completed_at, undefined);
    assert.ok(fakeClient.results[1].started_at);
    assert.equal(fakeClient.results[1].completed_at, undefined);
    assert.ok(fakeClient.results[2].completed_at);
    assert.equal(fakeClient.results[2].evidence.action, 'test_print');
  });

  it('fails safe when an allowlisted command requires confirmation', async () => {
    const state = createCommandExecutionState();
    const fakeClient = new FakeClient([command({ requires_confirmation: true, command_id: 'cmd_confirm', idempotency_key: 'idem_confirm' })]);

    await runKioskAgentCycle({
      config: config(),
      client: fakeClient,
      state,
      now: new Date('2026-06-12T12:00:00.000Z'),
    });

    assert.equal(fakeClient.results.length, 1);
    assert.equal(fakeClient.results[0].status, 'failed');
    assert.equal(fakeClient.results[0].error_code, 'COMMAND_REQUIRES_CONFIRMATION');
    assert.equal(fakeClient.results[0].evidence.confirmed, false);
    assert.equal(state.maintenance, false);
  });

  it('rejects arbitrary/non-allowlisted commands without execution', async () => {
    assert.deepEqual(allowedAgentCommandTypes, ['test_print', 'enter_maintenance', 'exit_maintenance', 'upload_logs']);
    const fakeClient = new FakeClient([command({ type: 'restart_runtime', command_id: 'cmd_restart', idempotency_key: 'idem_restart' })]);

    await runKioskAgentCycle({
      config: config(),
      client: fakeClient,
      state: createCommandExecutionState(),
      now: new Date('2026-06-12T12:00:00.000Z'),
    });

    assert.equal(fakeClient.results.length, 1);
    assert.equal(fakeClient.results[0].status, 'failed');
    assert.equal(fakeClient.results[0].error_code, 'COMMAND_NOT_ALLOWED');
    assert.match(fakeClient.results[0].message, /not allowlisted/);
  });

  it('reports expired commands and does not execute duplicate idempotency keys twice', async () => {
    const state = createCommandExecutionState();
    const fakeClient = new FakeClient([
      command({ command_id: 'expired', idempotency_key: 'expired_key', expires_at: '2026-06-11T00:00:00.000Z' }),
      command({ command_id: 'maint-1', type: 'enter_maintenance', idempotency_key: 'maint-key' }),
      command({ command_id: 'maint-duplicate', type: 'enter_maintenance', idempotency_key: 'maint-key' }),
    ]);

    await runKioskAgentCycle({
      config: config(),
      client: fakeClient,
      state,
      now: new Date('2026-06-12T12:00:00.000Z'),
    });

    assert.equal(fakeClient.results[0].status, 'expired');
    assert.equal(fakeClient.results[0].error_code, 'COMMAND_EXPIRED');
    assert.deepEqual(fakeClient.results.slice(1, 4).map((item) => item.status), ['accepted', 'running', 'succeeded']);
    assert.equal(fakeClient.results[3].evidence.maintenance, true);
    assert.equal(fakeClient.results[4].status, 'succeeded');
    assert.equal(fakeClient.results[4].evidence.duplicate_of_command_id, 'maint-1');
    assert.equal(state.maintenance, true);
  });

  it('rejects commands for another kiosk without executing lifecycle updates', async () => {
    const fakeClient = new FakeClient([command({ command_id: 'wrong-kiosk', kiosk_id: 'branch-002', idempotency_key: 'wrong-kiosk-key' })]);

    await runKioskAgentCycle({
      config: config(),
      client: fakeClient,
      state: createCommandExecutionState(),
      now: new Date('2026-06-12T12:00:00.000Z'),
    });

    assert.equal(fakeClient.results.length, 1);
    assert.equal(fakeClient.results[0].status, 'failed');
    assert.equal(fakeClient.results[0].error_code, 'KIOSK_MISMATCH');
    assert.equal(fakeClient.results[0].evidence.expected_kiosk_id, 'hq-001');
  });
});
