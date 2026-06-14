import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commandTypes, sessionStates, sharedTypeContractNames } from '../dist/index.js';

describe('@retail-kiosk/shared-types contracts', () => {
  it('exports the required core contract names', () => {
    assert.deepEqual([...sharedTypeContractNames].sort(), [
      'Command',
      'CommandResult',
      'EventEnvelope',
      'HardwareHealth',
      'HeartbeatPayload',
      'PrintJob',
      'PrinterAdapter',
      'SessionState',
      'Ticket',
      'TokenAdapter',
    ].sort());
  });

  it('keeps PRD session and command states available as runtime constants', () => {
    assert.ok(sessionStates.includes('idle'));
    assert.ok(sessionStates.includes('printing'));
    assert.ok(sessionStates.includes('maintenance'));
    assert.ok(commandTypes.includes('test_print'));
    assert.ok(commandTypes.includes('activate_package'));
  });
});
