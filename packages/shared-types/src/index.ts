export type * from './commands.js';
export type * from './events.js';
export type * from './hardware.js';
export type * from './heartbeat.js';
export type * from './session.js';
export type * from './tickets.js';

export { commandTypes } from './commands.js';
export { sessionStates } from './session.js';

export const sharedTypeContractNames = [
  'SessionState',
  'EventEnvelope',
  'Ticket',
  'PrintJob',
  'Command',
  'CommandResult',
  'HeartbeatPayload',
  'HardwareHealth',
  'TokenAdapter',
  'PrinterAdapter',
] as const;

export type SharedTypeContractName = (typeof sharedTypeContractNames)[number];
