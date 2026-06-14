import type { RuntimeClient, RuntimeState } from './runtime-client.js';

export const bridgeProtocol = 'retail-kiosk-package-bridge/v1';

export const bridgeCapabilities = [
  'recordTelemetry',
  'requestPrint',
  'complete',
  'fail',
  'getScheduleContext',
  'getRuntimeCapabilities',
] as const;

export type BridgeCapability = (typeof bridgeCapabilities)[number];

export interface PackageManifestForBridge {
  package_id: string;
  version: string;
  display_name: string;
  bridge_capabilities: readonly BridgeCapability[];
}

export interface BridgeRequest {
  protocol: typeof bridgeProtocol;
  type: 'request';
  id: string;
  method: BridgeCapability;
  payload?: unknown;
}

export interface BridgeResponse {
  protocol: typeof bridgeProtocol;
  type: 'response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface PackageBridgeOptions {
  iframe: HTMLIFrameElement;
  manifest: PackageManifestForBridge;
  runtimeClient: RuntimeClient;
  getRuntimeState: () => RuntimeState | null;
  onState?: (state: RuntimeState) => void;
  onTelemetry?: (event: Record<string, unknown>) => void;
  onPackageComplete?: (payload: Record<string, unknown>) => void;
  onPackageFailure?: (message: string) => void;
  targetOrigin?: string;
}

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/;
const capabilitySet = new Set<string>(bridgeCapabilities);

export function isBridgeCapability(value: unknown): value is BridgeCapability {
  return typeof value === 'string' && capabilitySet.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateBridgeRequest(message: unknown, allowedCapabilities: readonly BridgeCapability[]): { ok: true; request: BridgeRequest } | { ok: false; error: string } {
  if (!isRecord(message)) return { ok: false, error: 'message_not_object' };
  if (message.protocol !== bridgeProtocol) return { ok: false, error: 'protocol_mismatch' };
  if (message.type !== 'request') return { ok: false, error: 'type_not_request' };
  if (typeof message.id !== 'string' || !idPattern.test(message.id)) return { ok: false, error: 'invalid_request_id' };
  if (!isBridgeCapability(message.method)) return { ok: false, error: 'unknown_method' };
  if (!allowedCapabilities.includes(message.method)) return { ok: false, error: 'capability_not_allowed' };
  if ('payload' in message && message.payload !== undefined && !isRecord(message.payload)) return { ok: false, error: 'payload_not_object' };
  return { ok: true, request: message as unknown as BridgeRequest };
}

export function canPackageRequestPrint(state: RuntimeState | null): boolean {
  return state?.current_session?.state === 'playing' || state?.current_session?.state === 'result_pending';
}

function responseFor(id: string, result: unknown): BridgeResponse {
  return { protocol: bridgeProtocol, type: 'response', id, ok: true, result };
}

function errorFor(id: string, error: string): BridgeResponse {
  return { protocol: bridgeProtocol, type: 'response', id, ok: false, error };
}

export function mountPackageBridge(options: PackageBridgeOptions): () => void {
  const { iframe, manifest, runtimeClient } = options;
  const targetOrigin = options.targetOrigin ?? '*';

  function send(response: BridgeResponse): void {
    iframe.contentWindow?.postMessage(response, targetOrigin);
  }

  async function handleRequest(request: BridgeRequest): Promise<unknown> {
    const payload = isRecord(request.payload) ? request.payload : {};
    switch (request.method) {
      case 'recordTelemetry':
        options.onTelemetry?.({ package_id: manifest.package_id, package_version: manifest.version, ...payload });
        return { accepted: true };
      case 'getScheduleContext':
        return {
          package_id: manifest.package_id,
          package_version: manifest.version,
          display_name: manifest.display_name,
          runtime_state: options.getRuntimeState()?.runtime ?? null,
        };
      case 'getRuntimeCapabilities':
        return { capabilities: manifest.bridge_capabilities, protocol: bridgeProtocol };
      case 'requestPrint': {
        if (!canPackageRequestPrint(options.getRuntimeState())) throw new Error('session_not_ready_for_print');
        const printResponse = await runtimeClient.requestPrint({ result_payload: payload.result ?? payload, render_payload: payload.ticket ?? payload });
        options.onState?.(printResponse.state);
        return { ticket: printResponse.ticket ?? null, print: printResponse.print ?? null, state: printResponse.state.current_session?.state ?? printResponse.state.runtime.mode };
      }
      case 'complete':
        options.onPackageComplete?.(payload);
        return { accepted: true };
      case 'fail': {
        const message = typeof payload.message === 'string' ? payload.message : 'package_failed';
        options.onPackageFailure?.(message);
        return { accepted: true };
      }
    }
  }

  function onMessage(event: MessageEvent): void {
    if (event.source !== iframe.contentWindow) return;
    // A sandboxed iframe without allow-same-origin has an opaque origin reported as "null".
    if (event.origin !== 'null' && event.origin !== window.location.origin) return;
    const validation = validateBridgeRequest(event.data, manifest.bridge_capabilities);
    if (!validation.ok) {
      const id = isRecord(event.data) && typeof event.data.id === 'string' && idPattern.test(event.data.id) ? event.data.id : 'invalid';
      send(errorFor(id, validation.error));
      return;
    }
    void handleRequest(validation.request)
      .then((result) => send(responseFor(validation.request.id, result)))
      .catch((error: unknown) => send(errorFor(validation.request.id, error instanceof Error ? error.message : 'bridge_request_failed')));
  }

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
