import { createCentralApiServer } from './routes.js';
import { createPostgresCentralRepository, InMemoryCentralRepository } from './repository.js';

export {
  createCentralApiServer,
  getAdminFleetOverview,
  getAdminKiosk,
  ingestEventBatch,
  listAdminEvents,
  listAdminDeployments,
  listAdminKiosks,
  listAdminSchedules,
  pollDeviceCommands,
  recordCommandResult,
  recordHeartbeat,
} from './routes.js';
export { createPostgresCentralRepository, InMemoryCentralRepository } from './repository.js';
export type {
  AdminDeploymentsReadModel,
  AdminEventRow,
  AdminEventsFilter,
  AdminEventsReadModel,
  AdminFleetOverview,
  AdminKioskDetail,
  AdminKioskSummary,
  AdminSchedulesReadModel,
  CentralControlPlaneMetadata,
  CentralRepository,
  EventIngestResult,
  HeartbeatRecord,
} from './repository.js';

export const centralApiPackage = {
  name: '@retail-kiosk/central-api',
  kind: 'service',
  routes: [
    'POST /v1/heartbeats',
    'POST /v1/events/batch',
    'GET /v1/kiosks/:kiosk_id/commands',
    'POST /v1/commands/:command_id/result',
    'GET /v1/admin/fleet/overview',
    'GET /v1/admin/kiosks',
    'GET /v1/admin/kiosks/:kiosk_id',
    'GET /v1/admin/schedules',
    'GET /v1/admin/deployments',
    'GET /v1/admin/events',
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
