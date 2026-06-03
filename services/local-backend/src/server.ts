import Fastify from 'fastify';
import websocket from '@fastify/websocket';

type KioskEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

const eventLog: KioskEvent[] = [];

function recordEvent(type: string, payload: Record<string, unknown> = {}) {
  const event: KioskEvent = {
    id: crypto.randomUUID(),
    type,
    payload,
    occurredAt: new Date().toISOString(),
  };
  eventLog.push(event);
  return event;
}

const app = Fastify({ logger: true });
await app.register(websocket);

app.get('/api/health', async () => ({
  status: 'ok',
  service: 'local-backend',
  mode: 'simulated-hardware',
  queueLength: eventLog.length,
  time: new Date().toISOString(),
}));

app.post('/api/simulate/coin', async () => recordEvent('coin_inserted', { source: 'simulator' }));

app.post('/api/simulate/print', async () => recordEvent('ticket_print_success', { source: 'simulator' }));

app.get('/api/events', async () => ({ events: eventLog.slice(-100) }));

app.get('/ws', { websocket: true }, (connection) => {
  const heartbeat = setInterval(() => {
    connection.socket.send(JSON.stringify({ type: 'heartbeat', time: new Date().toISOString() }));
  }, 5000);

  connection.socket.on('close', () => clearInterval(heartbeat));
});

const host = process.env.LOCAL_BACKEND_HOST ?? '127.0.0.1';
const port = Number(process.env.LOCAL_BACKEND_PORT ?? 8787);

await app.listen({ host, port });
