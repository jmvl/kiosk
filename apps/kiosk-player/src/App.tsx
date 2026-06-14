import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RuntimeState } from './runtime-client.js';
import { createRuntimeClient } from './runtime-client.js';
import { chocomelManifest, demoPackageHtml } from './demo-package.js';
import { mountPackageBridge } from './package-bridge.js';
import './styles.css';

type Screen = 'idle' | 'game' | 'result' | 'maintenance' | 'error';

const hqDebugControlsEnabled = import.meta.env.VITE_KIOSK_PLAYER_HQ_DEBUG_CONTROLS === 'true';

function recordValue(value: unknown, key: string): unknown {
  return value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : undefined;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function customerTicketSummary(latestTicket: unknown, lastResult: unknown) {
  const renderPayload = recordValue(latestTicket, 'render_payload');
  return {
    title: textValue(recordValue(latestTicket, 'title'))
      ?? textValue(recordValue(renderPayload, 'title'))
      ?? textValue(recordValue(lastResult, 'title'))
      ?? 'Prize confirmed',
    body: textValue(recordValue(latestTicket, 'body'))
      ?? textValue(recordValue(renderPayload, 'body'))
      ?? textValue(recordValue(lastResult, 'body'))
      ?? 'Please collect your printed ticket from the kiosk.',
    status: textValue(recordValue(latestTicket, 'print_status'))
      ?? textValue(recordValue(lastResult, 'status'))
      ?? 'Ticket ready',
  };
}

function screenFor(state: RuntimeState | null, error: string | null): Screen {
  if (error) return 'error';
  const mode = state?.runtime.mode ?? 'idle';
  if (mode === 'maintenance' || mode === 'degraded_printer' || mode === 'degraded_token_input') return 'maintenance';
  const sessionState = state?.current_session?.state;
  if (sessionState === 'playing' || sessionState === 'result_pending' || sessionState === 'print_requested' || sessionState === 'printing') return 'game';
  if (sessionState === 'completed' || sessionState === 'resetting') return 'result';
  return 'idle';
}

export function KioskPlayerApp() {
  const runtimeClient = useMemo(() => createRuntimeClient(), []);
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const [lastResult, setLastResult] = useState<unknown | null>(null);
  const [telemetry, setTelemetry] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [packageIframe, setPackageIframe] = useState<HTMLIFrameElement | null>(null);
  const stateRef = useRef<RuntimeState | null>(null);
  stateRef.current = runtimeState;
  const screen = screenFor(runtimeState, error);
  const ticketSummary = customerTicketSummary(runtimeState?.latest_ticket, lastResult);
  const setPackageIframeRef = useCallback((node: HTMLIFrameElement | null) => {
    setPackageIframe(node);
  }, []);

  useEffect(() => {
    let cancelled = false;
    runtimeClient.getState()
      .then((state) => { if (!cancelled) setRuntimeState(state); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    const unsubscribe = runtimeClient.subscribe((state) => {
      setRuntimeState(state);
      setError(null);
    }, () => setError('runtime_websocket_error'));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [runtimeClient]);

  useEffect(() => {
    if (!packageIframe) return;
    return mountPackageBridge({
      iframe: packageIframe,
      manifest: chocomelManifest,
      runtimeClient,
      getRuntimeState: () => stateRef.current,
      onState: setRuntimeState,
      onTelemetry: (event) => setTelemetry((events) => [...events.slice(-4), event]),
      onPackageComplete: (payload) => setLastResult(payload),
      onPackageFailure: (message) => setError(message),
    });
  }, [packageIframe, runtimeClient]);

  async function startFakeSession() {
    setError(null);
    try {
      setRuntimeState(await runtimeClient.injectDevToken({ source: 'kiosk-player', amount_cents: 100, fake: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function enterMaintenance() {
    setError(null);
    try { setRuntimeState(await runtimeClient.enterMaintenance()); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function exitMaintenance() {
    setError(null);
    try { setRuntimeState(await runtimeClient.exitMaintenance()); } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  return (
    <main className={`kiosk-shell screen-${screen}`}>
      <header className="top-bar">
        <div>
          <p className="eyebrow">Retail kiosk player</p>
          <h1>{chocomelManifest.display_name}</h1>
        </div>
        <div className="runtime-pill">{runtimeState?.runtime.kiosk_id ?? 'offline'} · {runtimeState?.runtime.mode ?? 'connecting'}</div>
      </header>

      {screen === 'idle' && (
        <section className="stage attract">
          <div className="coin-orbit" aria-hidden="true" />
          <p className="eyebrow">Idle / attract loop</p>
          <h2>Ready for the next activation</h2>
          <p>Campaigns can start by token, schedule, operator action, or autoplay. The local runtime remains the authority for sessions, tickets, printing, and reset.</p>
          {hqDebugControlsEnabled && <button className="primary" type="button" onClick={startFakeSession}>HQ debug: inject fake token</button>}
        </section>
      )}

      {screen === 'game' && (
        <section className="stage game-grid">
          <div>
            <p className="eyebrow">Sandboxed activation package</p>
            <h2>Activation active</h2>
            <p>The iframe has no same-origin privilege and no runtime URL. It can only request allowed bridge capabilities via postMessage.</p>
            {hqDebugControlsEnabled && (
              <dl className="session-list" aria-label="HQ debug session diagnostics">
                <dt>HQ debug session</dt><dd>{runtimeState?.current_session?.session_id ?? 'pending'}</dd>
                <dt>HQ debug state</dt><dd>{runtimeState?.current_session?.state ?? runtimeState?.runtime.mode}</dd>
                <dt>HQ debug bridge telemetry</dt><dd>{telemetry.length} events</dd>
              </dl>
            )}
          </div>
          <iframe
            ref={setPackageIframeRef}
            title="Chocomel activation package"
            className="package-frame"
            sandbox="allow-scripts allow-forms"
            referrerPolicy="no-referrer"
            srcDoc={demoPackageHtml}
          />
        </section>
      )}

      {screen === 'result' && (
        <section className="stage result-card">
          <p className="eyebrow">Result / reset</p>
          <h2>{ticketSummary.title}</h2>
          <p>{ticketSummary.body}</p>
          <p className="ticket-status" aria-label="ticket status">{ticketSummary.status}</p>
          {hqDebugControlsEnabled && <button className="primary" type="button" onClick={startFakeSession}>HQ debug: run another fake token</button>}
        </section>
      )}

      {screen === 'maintenance' && (
        <section className="stage maintenance-card">
          <p className="eyebrow">Maintenance / degraded</p>
          <h2>Kiosk unavailable</h2>
          <p>Runtime reports {runtimeState?.runtime.mode}. Customer play is disabled until maintenance exits.</p>
          {hqDebugControlsEnabled && <button className="primary" type="button" onClick={exitMaintenance}>HQ debug: exit maintenance</button>}
        </section>
      )}

      {screen === 'error' && (
        <section className="stage error-card">
          <p className="eyebrow">Runtime error</p>
          <h2>Local runtime unavailable</h2>
          <p>{error}</p>
          <button className="primary" type="button" onClick={() => window.location.reload()}>Retry</button>
        </section>
      )}

      {hqDebugControlsEnabled && (
        <footer className="operator-rail" aria-label="HQ debug controls">
          <span>HQ debug controls</span>
          <button type="button" onClick={startFakeSession}>HQ debug: fake token</button>
          <button type="button" onClick={enterMaintenance}>HQ debug: enter maintenance</button>
          <button type="button" onClick={exitMaintenance}>HQ debug: exit maintenance</button>
        </footer>
      )}
    </main>
  );
}

export default KioskPlayerApp;
