<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { RuntimeState } from './runtime-client.js';
  import { createRuntimeClient } from './runtime-client.js';
  import { bridgeProtocol, mountPackageBridge } from './package-bridge.js';
  import { drOetkerManifest, drOetkerModuleHtml, localized, segmentIndexForOutcome, type CampaignLocale, type CampaignOutcome } from './demo-package.js';
  import './styles.css';

  type Screen = 'idle' | 'game' | 'result' | 'maintenance' | 'error';
  type Reveal = { title: string; body: string; status: string; outcomeId?: string; ticket?: unknown };

  const hqDebugControlsEnabled = import.meta.env.VITE_KIOSK_PLAYER_HQ_DEBUG_CONTROLS === 'true';
  const runtimeClient = createRuntimeClient();
  const defaultLanguage: CampaignLocale = 'fr-BE';
  const resultRevealResetMs = 12_000;

  let runtimeState: RuntimeState | null = null;
  let selectedLanguage: CampaignLocale = defaultLanguage;
  let quizMessage: string | null = null;
  let reveal: Reveal | null = null;
  let telemetry: Record<string, unknown>[] = [];
  let error: string | null = null;
  let busy = false;
  let spinCount = 0;
  let packageFrame: HTMLIFrameElement | null = null;
  let resultResetTimer: ReturnType<typeof setTimeout> | null = null;

  function recordValue(value: unknown, key: string): unknown {
    return value && typeof value === 'object' && key in value ? (value as Record<string, unknown>)[key] : undefined;
  }

  function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  function isCampaignOutcome(value: unknown): value is CampaignOutcome {
    return Boolean(value && typeof value === 'object' && typeof recordValue(value, 'outcome_id') === 'string');
  }

  function activeLanguage(state: RuntimeState | null = runtimeState, fallbackLanguage: CampaignLocale = selectedLanguage): CampaignLocale {
    return state?.current_session?.session_language ?? fallbackLanguage;
  }

  function customerTicketSummary(latestTicket: unknown, fallback: Reveal | null): Reveal {
    const renderPayload = recordValue(latestTicket, 'render_payload');
    return {
      title: textValue(recordValue(latestTicket, 'title'))
        ?? textValue(recordValue(renderPayload, 'localized_label'))
        ?? fallback?.title
        ?? 'Résultat confirmé',
      body: textValue(recordValue(latestTicket, 'body'))
        ?? textValue(recordValue(renderPayload, 'cashier_instruction'))
        ?? fallback?.body
        ?? 'Présentez le ticket imprimé à la caisse.',
      status: textValue(recordValue(latestTicket, 'print_status'))
        ?? fallback?.status
        ?? 'Ticket prêt',
      ...(fallback?.outcomeId ? { outcomeId: fallback.outcomeId } : {}),
    };
  }

  function screenFor(state: RuntimeState | null, errorMessage: string | null, revealValue: Reveal | null): Screen {
    if (errorMessage) return 'error';
    const mode = state?.runtime.mode ?? 'idle';
    if (mode === 'maintenance' || mode === 'degraded_printer' || mode === 'degraded_token_input') return 'maintenance';
    const sessionState = state?.current_session?.state;
    if (sessionState === 'playing' || sessionState === 'result_pending' || sessionState === 'print_requested' || sessionState === 'printing') return 'game';
    if (revealValue || sessionState === 'completed' || sessionState === 'resetting') return 'result';
    return 'idle';
  }

  $: language = activeLanguage(runtimeState, selectedLanguage);
  $: languageLocked = Boolean(runtimeState?.current_session?.session_language || (runtimeState?.current_session?.quiz_attempts ?? 0) > 0 || runtimeState?.current_session?.quiz_passed);
  $: canSpin = runtimeState?.current_session?.state === 'playing' && runtimeState?.current_session?.quiz_passed === true;
  $: screen = screenFor(runtimeState, error, reveal);
  $: ticketSummary = customerTicketSummary(reveal?.ticket ?? null, reveal);
  $: currentSegmentIndex = reveal?.outcomeId ? segmentIndexForOutcome(reveal.outcomeId, Math.max(spinCount - 1, 0)) : 0;

  onMount(() => {
    let cancelled = false;
    runtimeClient.getState()
      .then((state) => { if (!cancelled) applyRuntimeState(state); })
      .catch((err: unknown) => { if (!cancelled) error = err instanceof Error ? err.message : String(err); });
    const unsubscribe = runtimeClient.subscribe((state) => {
      applyRuntimeState(state);
      error = null;
    }, () => { error = 'runtime_websocket_error'; });
    return () => {
      cancelled = true;
      clearResultResetTimer();
      unsubscribe();
    };
  });

  function clearResultResetTimer() {
    if (resultResetTimer) clearTimeout(resultResetTimer);
    resultResetTimer = null;
  }

  function resetToIdlePresentation() {
    setReveal(null);
    quizMessage = null;
    postPresentation({ action: 'idle', label: localized(drOetkerManifest.quiz.question, activeLanguage()) });
  }

  function setReveal(nextReveal: Reveal | null) {
    reveal = nextReveal;
    clearResultResetTimer();
    if (nextReveal) {
      resultResetTimer = setTimeout(resetToIdlePresentation, resultRevealResetMs);
    }
  }

  function packageBridge(node: HTMLIFrameElement) {
    packageFrame = node;
    const destroyBridge = mountPackageBridge({
      iframe: node,
      manifest: drOetkerManifest,
      runtimeClient,
      getRuntimeState: () => runtimeState,
      onState: applyRuntimeState,
      onTelemetry: (event) => { telemetry = [...telemetry.slice(-4), event]; },
      onPackageComplete: () => undefined,
      onPackageFailure: (message) => { error = message; },
    });
    return {
      destroy: () => {
        packageFrame = null;
        destroyBridge();
      },
    };
  }

  function applyRuntimeState(state: RuntimeState) {
    const hadSession = Boolean(runtimeState?.current_session);
    runtimeState = state;
    if (state.current_session?.session_language) selectedLanguage = state.current_session.session_language;
    if (state.current_session && !hadSession) {
      setReveal(null);
      quizMessage = null;
      postPresentation({ action: 'idle', label: localized(drOetkerManifest.quiz.question, activeLanguage(state)) });
    }
  }

  function postPresentation(payload: Record<string, unknown>) {
    packageFrame?.contentWindow?.postMessage({ protocol: bridgeProtocol, type: 'presentation', ...payload }, '*');
  }

  function selectLanguage(nextLanguage: CampaignLocale) {
    if (!languageLocked) {
      selectedLanguage = nextLanguage;
      postPresentation({ action: 'idle', label: localized(drOetkerManifest.quiz.question, nextLanguage) });
    }
  }

  async function submitAnswer(choiceId: string) {
    if (busy || !runtimeState?.current_session) return;
    busy = true;
    error = null;
    quizMessage = null;
    try {
      const response = await runtimeClient.submitQuizAnswer({ language, choice_id: choiceId });
      applyRuntimeState(response.state);
      if (response.quiz.correct) {
        quizMessage = language === 'fr-BE' ? 'Bonne réponse. Faites tourner la roue.' : 'Juist antwoord. Draai aan het wiel.';
      } else if (response.quiz.retry) {
        quizMessage = localized(drOetkerManifest.quiz.retry_copy, language);
      } else {
        setReveal({
          title: language === 'fr-BE' ? 'Merci de votre participation' : 'Bedankt voor uw deelname',
          body: localized(drOetkerManifest.quiz.failed_copy, language),
          status: language === 'fr-BE' ? 'Aucun ticket imprimé' : 'Geen ticket afgedrukt',
          ticket: null,
        });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  async function startSpin() {
    if (busy || !canSpin) return;
    busy = true;
    error = null;
    quizMessage = null;
    try {
      const response = await runtimeClient.startSpin();
      const outcome = isCampaignOutcome(response.outcome) ? response.outcome : null;
      const outcomeId = outcome?.outcome_id ?? textValue(recordValue(response.outcome, 'outcome_id')) ?? undefined;
      spinCount += 1;
      const segmentIndex = outcomeId ? segmentIndexForOutcome(outcomeId, spinCount - 1) : 0;
      const title = outcome ? localized(outcome.localized_label, language) : 'Résultat confirmé';
      setReveal({
        title,
        body: outcome ? localized(outcome.cashier_instruction, language) : (language === 'fr-BE' ? 'Résultat confirmé par le kiosque.' : 'Resultaat bevestigd door de kiosk.'),
        status: outcome?.print_ticket === false ? (language === 'fr-BE' ? 'Aucun ticket imprimé' : 'Geen ticket afgedrukt') : (language === 'fr-BE' ? 'Ticket en cours' : 'Ticket wordt afgedrukt'),
        ticket: response.ticket ?? null,
        ...(outcomeId ? { outcomeId } : {}),
      });
      postPresentation({ action: 'spin', segmentIndex, label: title });
      await tick();
      applyRuntimeState(response.state);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  async function startFakeSession() {
    error = null;
    setReveal(null);
    quizMessage = null;
    try {
      applyRuntimeState(await runtimeClient.injectDevToken({ source: 'kiosk-player', amount_cents: 100, fake: true }));
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function enterMaintenance() {
    error = null;
    try {
      applyRuntimeState(await runtimeClient.enterMaintenance());
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function exitMaintenance() {
    error = null;
    try {
      applyRuntimeState(await runtimeClient.exitMaintenance());
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<main class={`kiosk-shell screen-${screen}`}>
  <header class="top-bar">
    <div>
      <p class="eyebrow">Concours · Wedstrijd</p>
      <h1>{drOetkerManifest.display_name}</h1>
    </div>
    <div class="runtime-pill">{runtimeState?.runtime.mode ?? 'connecting'}</div>
  </header>

  {#if screen === 'idle'}
    <section class="stage attract pizza-attract">
      <div class="coin-orbit pizza-orbit" aria-hidden="true"></div>
      <p class="eyebrow">Token start</p>
      <h2>Pizza Wheel</h2>
      <p>{selectedLanguage === 'fr-BE' ? 'Insérez le jeton reçu en caisse pour participer.' : 'Steek de jeton van de kassa in om deel te nemen.'}</p>
      {#if hqDebugControlsEnabled}<button class="primary" type="button" on:click={startFakeSession}>HQ debug: inject fake token</button>{/if}
    </section>
  {/if}

  {#if screen === 'game'}
    <section class="stage game-grid pizza-game">
      <div class="quiz-panel">
        <p class="eyebrow">Question</p>
        <h2>{localized(drOetkerManifest.quiz.question, language)}</h2>
        <div class="language-switch" aria-label="FR NL language switch">
          <button class:active-language={language === 'fr-BE'} disabled={languageLocked || busy} type="button" on:click={() => selectLanguage('fr-BE')}>FR</button>
          <button class:active-language={language === 'nl-BE'} disabled={languageLocked || busy} type="button" on:click={() => selectLanguage('nl-BE')}>NL</button>
        </div>
        <div class="answer-grid">
          {#each drOetkerManifest.quiz.choices as choice}
            <button type="button" disabled={busy || canSpin} on:click={() => submitAnswer(choice.choice_id)}>{localized(choice.label, language)}</button>
          {/each}
        </div>
        {#if quizMessage}<p class="quiz-message">{quizMessage}</p>{/if}
        <button class="primary spin-button" type="button" disabled={!canSpin || busy} on:click={startSpin}>{language === 'fr-BE' ? 'Faire tourner' : 'Draai'}</button>
        {#if hqDebugControlsEnabled}
          <dl class="session-list" aria-label="HQ debug session diagnostics">
            <dt>HQ debug state</dt><dd>{runtimeState?.current_session?.state ?? runtimeState?.runtime.mode}</dd>
            <dt>HQ debug bridge telemetry</dt><dd>{telemetry.length} events</dd>
          </dl>
        {/if}
      </div>
      <iframe
        use:packageBridge
        bind:this={packageFrame}
        title="Dr. Oetker Pizza Wheel presentation module"
        class="package-frame pizza-frame"
        sandbox="allow-scripts allow-forms"
        referrerpolicy="no-referrer"
        srcdoc={drOetkerModuleHtml}
      ></iframe>
    </section>
  {/if}

  {#if screen === 'result'}
    <section class="stage result-card pizza-result">
      <p class="eyebrow">Result / reset</p>
      <div class="result-wheel" style={`--segment-index:${currentSegmentIndex}`} aria-hidden="true"></div>
      <h2>{ticketSummary.title}</h2>
      <p>{ticketSummary.body}</p>
      <p class="ticket-status" aria-label="ticket status">{ticketSummary.status}</p>
      {#if hqDebugControlsEnabled}<button class="primary" type="button" on:click={startFakeSession}>HQ debug: run another fake token</button>{/if}
    </section>
  {/if}

  {#if screen === 'maintenance'}
    <section class="stage maintenance-card">
      <p class="eyebrow">Maintenance</p>
      <h2>Kiosk unavailable</h2>
      <p>{language === 'fr-BE' ? 'Veuillez demander de l’aide au personnel.' : 'Vraag een medewerker om hulp.'}</p>
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
