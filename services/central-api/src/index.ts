import { createCentralApiServer } from './routes.js';
import { createPostgresCentralRepository, InMemoryCentralRepository } from './repository.js';

export { createCentralApiServer, ingestEventBatch, pollDeviceCommands, recordCommandResult, recordHeartbeat } from './routes.js';
export { createPostgresCentralRepository, InMemoryCentralRepository } from './repository.js';
export type { CentralRepository, EventIngestResult, HeartbeatRecord } from './repository.js';

export const centralApiPackage = {
  name: '@retail-kiosk/central-api',
  kind: 'service',
  routes: [
    'POST /v1/heartbeats',
    'POST /v1/events/batch',
    'GET /v1/kiosks/:kiosk_id/commands',
    'POST /v1/commands/:command_id/result',
  ],
} as const;

export type CentralApiPackage = typeof centralApiPackage;

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const databaseUrl = process.env.CENTRAL_DATABASE_URL ?? process.env.DATABASE_URL;
  const repository = databaseUrl ? createPostgresCentralRepository(databaseUrl) : new InMemoryCentralRepository();
  const port = Number(process.env.PORT ?? 8080);
  createCentralApiServer(repository).listen(port, () => {
    console.log(`central-api listening on :${port}${databaseUrl ? '' : ' with in-memory repository'}`);
  });
}
