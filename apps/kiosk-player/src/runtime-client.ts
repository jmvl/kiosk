import type { SessionSnapshot, SessionState } from '@retail-kiosk/shared-types';

export interface RuntimeState {
  runtime: {
    kiosk_id: string;
    mode: SessionState | 'idle' | string;
    current_session_id: string | null;
    active_package_id: string;
    active_package_version: string;
    local_sequence: number;
    last_heartbeat_at: string | null;
    last_error: string | null;
    updated_at: string;
  };
  current_session: SessionSnapshot | null;
  latest_ticket: unknown | null;
  adapters: {
    token: unknown;
    printer: unknown;
  };
}

export interface RuntimeClientConfig {
  baseUrl: string;
  wsUrl: string;
  authToken?: string;
  fetchImpl?: typeof fetch;
  webSocketImpl?: typeof WebSocket;
}

export interface RuntimeClient {
  getState(): Promise<RuntimeState>;
  injectDevToken(payload?: Record<string, unknown>): Promise<RuntimeState>;
  submitQuizAnswer(payload: { language: 'fr-BE' | 'nl-BE'; choice_id: string }): Promise<{ quiz: QuizAnswerResponse; state: RuntimeState }>;
  startSpin(): Promise<SpinStartResponse>;
  requestPrint(payload?: Record<string, unknown>): Promise<{ state: RuntimeState; ticket?: unknown; print?: unknown }>;
  enterMaintenance(): Promise<RuntimeState>;
  exitMaintenance(): Promise<RuntimeState>;
  subscribe(onState: (state: RuntimeState) => void, onError?: (error: Event) => void): () => void;
}

export interface QuizAnswerResponse {
  correct: boolean;
  retry: boolean;
  attempts: number;
  completed_no_reward: boolean;
  session: unknown;
}

export interface SpinStartResponse {
  outcome: unknown;
  ticket?: unknown;
  print?: unknown;
  session: unknown;
  state: RuntimeState;
}

function defaultRuntimeBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }
  return 'http://127.0.0.1:8787';
}

export function runtimeConfigFromEnv(env: ImportMetaEnv = import.meta.env): RuntimeClientConfig {
  const baseUrl = env.VITE_LOCAL_RUNTIME_URL || defaultRuntimeBaseUrl();
  return {
    baseUrl,
    wsUrl: env.VITE_LOCAL_RUNTIME_WS_URL || baseUrl.replace(/^http/, 'ws') + '/ws',
    ...(env.VITE_LOCAL_RUNTIME_TOKEN ? { authToken: env.VITE_LOCAL_RUNTIME_TOKEN } : {}),
  };
}

function authHeaders(config: RuntimeClientConfig): HeadersInit {
  return config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {};
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : `runtime_http_${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function createRuntimeClient(config: RuntimeClientConfig = runtimeConfigFromEnv()): RuntimeClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const webSocketImpl = config.webSocketImpl ?? WebSocket;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = { ...authHeaders(config), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers };
    const response = await fetchImpl(`${config.baseUrl}${path}`, { ...init, headers });
    return parseJsonResponse<T>(response);
  }

  return {
    async getState() {
      return request<RuntimeState>('/state');
    },
    async injectDevToken(payload = { source: 'kiosk-player', fake: true }) {
      const response = await request<{ state: RuntimeState }>('/dev/token', { method: 'POST', body: JSON.stringify(payload) });
      return response.state;
    },
    async submitQuizAnswer(payload) {
      return request<{ quiz: QuizAnswerResponse; state: RuntimeState }>('/quiz/answer', { method: 'POST', body: JSON.stringify(payload) });
    },
    async startSpin() {
      return request<SpinStartResponse>('/spin/start', { method: 'POST', body: JSON.stringify({}) });
    },
    async requestPrint(payload = {}) {
      return request<{ state: RuntimeState; ticket?: unknown; print?: unknown }>('/print/test', { method: 'POST', body: JSON.stringify(payload) });
    },
    async enterMaintenance() {
      const response = await request<{ state: RuntimeState }>('/maintenance/enter', { method: 'POST' });
      return response.state;
    },
    async exitMaintenance() {
      const response = await request<{ state: RuntimeState }>('/maintenance/exit', { method: 'POST' });
      return response.state;
    },
    subscribe(onState, onError) {
      const url = config.authToken ? `${config.wsUrl}${config.wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(config.authToken)}` : config.wsUrl;
      const socket = new webSocketImpl(url);
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; state?: RuntimeState };
          if (message.type === 'state' && message.state) onState(message.state);
        } catch {
          // Ignore malformed local development messages; REST polling remains authoritative.
        }
      });
      if (onError) socket.addEventListener('error', onError);
      return () => socket.close();
    },
  };
}
