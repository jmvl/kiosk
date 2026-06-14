import { startLocalBackendServer } from './server.js';

const app = await startLocalBackendServer();
const address = app.server.address();
const rendered = typeof address === 'string' ? address : `${address?.address ?? '127.0.0.1'}:${address?.port ?? ''}`;
console.log(`local-backend listening on ${rendered}`);

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
