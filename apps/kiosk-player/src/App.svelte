<script lang="ts">
  import { onMount } from 'svelte';
  import type { RuntimeState } from './runtime-client.js';
  import { createRuntimeClient } from './runtime-client.js';
  import { chocomelManifest, demoPackageHtml } from './demo-package.js';
  import { mountPackageBridge } from './package-bridge.js';
  import './styles.css';

  type Screen = 'idle' | 'game' | 'result' | 'maintenance' | 'error';

  const hqDebugControlsEnabled = import.meta.env.VITE_KIOSK_PLAYER_HQ_DEBUG_CONTROLS === 'true';
  const runtimeClient = createRuntimeClient();

  let runtimeState: RuntimeState | null = null;
  let lastResult: unknown | null = null;
  let telemetry: Record<string, unknown>[] = [];
  let error: string | null = null;

  function recordValue(value: unknown, key: string): unknown {
    return value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : undefined;
  }

  function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  function customerTicketSummary(latestTicket: unknown, lastResultValue: unknown) {
    const renderPayload = recordValue(latestTicket, 'render_payload');
    return {
      title: textValue(recordValue(latestTicket, 'title'))
        ?? textValue(recordValue(renderPayload, 'title'))
        ?? textValue(recordValue(lastResultValue, 'title'))
        ?? 'Prize confirmed',
      body: textValue(recordValue(latestTicket, 'body'))
        ?? textValue(recordValue(renderPayload, 'body'))
        ?? textValue(recordValue(lastResultValue, 'body'))
        ?? 'Please collect your printed ticket from the kiosk.',
      status: textValue(recordValue(latestTicket, 'print_status'))
        ?? textValue(recordValue(lastResultValue, 'status'))
        ?? 'Ticket ready',
    };
  }

  function screenFor(state: RuntimeState | null, errorMessage: string | null): Screen {
    if (errorMessage) return 'error';
    const mode = state?.runtime.mode ?? 'idle';
    if (mode === 'maintenance' || mode === 'degraded_printer' || mode === 'degraded_token_input') return 'maintenance';
    const sessionState = state?.current_session?.state;
    if (sessionState === 'playing' || sessionState === 'result_pending' || sessionState === 'print_requested' || sessionState === 'printing') return 'game';
    if (sessionState === 'completed' || sessionState === 'resetting') return 'result';
    return 'idle';
  }

  $: screen = screenFor(runtimeState, error);
  $: ticketSummary = customerTicketSummary(runtimeState?.latest_ticket, lastResult);

  onMount(() => {
    let cancelled = false;
    runtimeClient.getState()
      .then((state) => { if (!cancelled) runtimeState = state; })
      .catch((err: unknown) => { if (!cancelled) error = err instanceof Error ? err.message : String(err); });
    const unsubscribe = runtimeClient.subscribe((state) => {
      runtimeState = state;
      error = null;
    }, () => { error = 'runtime_websocket_error'; });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  });

  function packageBridge(node: HTMLIFrameElement) {
    return {
      destroy: mountPackageBridge({
        iframe: node,
        manifest: chocomelManifest,
        runtimeClient,
        getRuntimeState: () => runtimeState,
        onState: (state) => { runtimeState = state; },
        onTelemetry: (event) => { telemetry = [...telemetry.slice(-4), event]; },
        onPackageComplete: (payload) => { lastResult = payload; },
        onPackageFailure: (message) => { error = message; },
      }),
    };
  }

  async function startFakeSession() {
    error = null;
    try {
      runtimeState = await runtimeClient.injectDevToken({ source: 'kiosk-player', amount_cents: 100, fake: true });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function enterMaintenance() {
    error = null;
    try {
      runtimeState = await runtimeClient.enterMaintenance();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function exitMaintenance() {
    error = null;
    try {
      runtimeState = await runtimeClient.exitMaintenance();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<main class={`kiosk-shell screen-${screen}`}>
  <header class="top-bar">
    <div>
      <p class="eyebrow">Retail kiosk player</p>
      <h1>{chocomelManifest.display_name}</h1>
    </div>
    <div class="runtime-pill">{runtimeState?.runtime.kiosk_id ?? 'offline'} · {runtimeState?.runtime.mode ?? 'connecting'}</div>
  </header>

  {#if screen === 'idle'}
    <section class="stage attract">
      <div class="coin-orbit" aria-hidden="true"></div>
      <p class="eyebrow">Idle / attract loop</p>
      <h2>Ready for the next activation</h2>
      <p>Campaigns can start by token, schedule, operator action, or autoplay. The local runtime remains the authority for sessions, tickets, printing, and reset.</p>
      {#if hqDebugControlsEnabled}<button class="primary" type="button" on:click={startFakeSession}>HQ debug: inject fake token</button>{/if}
    </section>
  {/if}

  {#if screen === 'game'}
    <section class="stage game-grid">
      <div>
        <p class="eyebrow">Sandboxed activation package</p>
        <h2>Activation active</h2>
        <p>The iframe has no same-origin privilege and no runtime URL. It can only request allowed bridge capabilities via postMessage.</p>
        {#if hqDebugControlsEnabled}
          <dl class="session-list" aria-label="HQ debug session diagnostics">
            <dt>HQ debug session</dt><dd>{runtimeState?.current_session?.session_id ?? 'pending'}</dd>
            <dt>HQ debug state</dt><dd>{runtimeState?.current_session?.state ?? runtimeState?.runtime.mode}</dd>
            <dt>HQ debug bridge telemetry</dt><dd>{telemetry.length} events</dd>
          </dl>
        {/if}
      </div>
      <iframe
        use:packageBridge
        title="Chocomel activation package"
        class="package-frame"
        sandbox="allow-scripts allow-forms"
        referrerpolicy="no-referrer"
        srcdoc={demoPackageHtml}
      ></iframe>
    </section>
  {/if}

  {#if screen === 'result'}
    <section class="stage result-card">
      <p class="eyebrow">Result / reset</p>
      <h2>{ticketSummary.title}</h2>
      <p>{ticketSummary.body}</p>
      <p class="ticket-status" aria-label="ticket status">{ticketSummary.status}</p>
      {#if hqDebugControlsEnabled}<button class="primary" type="button" on:click={startFakeSession}>HQ debug: run another fake token</button>{/if}
    </section>
  {/if}

  {#if screen === 'maintenance'}
    <section class="stage maintenance-card">
      <p class="eyebrow">Maintenance / degraded</p>
      <h2>Kiosk unavailable</h2>
      <p>Runtime reports {runtimeState?.runtime.mode}. Customer play is disabled until maintenance exits.</p>
      {#if hqDebugControlsEnabled}<button class="primary" type="button" on:click={exitMaintenance}>HQ debug: exit maintenance</button>{/if}
    </section>
  {/if}

  {#if screen === 'error'}
    <section class="stage error-card">
      <p class="eyebrow">Runtime error</p>
      <h2>Local runtime unavailable</h2>
      <p>{error}</p>
      <button class="primary" type="button" on:click={() => window.location.reload()}>Retry</button>
    </section>
  {/if}

  {#if hqDebugControlsEnabled}
    <footer class="operator-rail" aria-label="HQ debug controls">
      <span>HQ debug controls</span>
      <button type="button" on:click={startFakeSession}>HQ debug: fake token</button>
      <button type="button" on:click={enterMaintenance}>HQ debug: enter maintenance</button>
      <button type="button" on:click={exitMaintenance}>HQ debug: exit maintenance</button>
    </footer>
  {/if}
</main>
