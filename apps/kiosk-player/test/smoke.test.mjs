import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import packageJson from '../package.json' with { type: 'json' };

const appSource = readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../src/package-bridge.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/runtime-client.ts', import.meta.url), 'utf8');
const fixtureSource = readFileSync(new URL('../src/demo-package.ts', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

describe('@retail-kiosk/kiosk-player package', () => {
  it('declares Svelte/Vite build, typecheck, and test scripts without React runtime baggage', () => {
    assert.equal(packageJson.name, '@retail-kiosk/kiosk-player');
    assert.match(packageJson.description, /Svelte\/Vite/);
    assert.match(packageJson.scripts.build, /vite build/);
    assert.equal(packageJson.scripts.typecheck, 'svelte-check --tsconfig ./tsconfig.json');
    assert.equal(packageJson.scripts.test, 'NODE_OPTIONS=--conditions=browser node --test test/*.test.mjs');
    assert.ok(packageJson.dependencies.svelte);
    assert.ok(packageJson.dependencies.vite);
    assert.equal(packageJson.dependencies.react, undefined);
    assert.equal(packageJson.dependencies['react-dom'], undefined);
    assert.equal(packageJson.dependencies['@vitejs/plugin-react'], undefined);
  });

  it('mounts a Svelte player shell instead of a React root', () => {
    assert.match(mainSource, /import \{ mount \} from 'svelte'/);
    assert.match(mainSource, /from '\.\/App\.svelte'/);
    assert.doesNotMatch(mainSource, /react|react-dom|createRoot|tsx/i);
  });

  it('contains the required customer screens and iframe sandbox', () => {
    for (const marker of ["screen === 'idle'", "screen === 'game'", "screen === 'result'", "screen === 'maintenance'", "screen === 'error'"]) {
      assert.ok(appSource.includes(marker), `missing ${marker}`);
    }
    assert.match(appSource, /sandbox="allow-scripts allow-forms"/);
    assert.doesNotMatch(appSource, /allow-same-origin/);
  });

  it('keeps normal player mode customer-safe with no raw tickets or debug controls unless explicitly enabled', () => {
    assert.match(appSource, /hqDebugControlsEnabled/);
    assert.match(appSource, /render_payload/);
    assert.match(appSource, /ticketSummary\.title/);
    assert.match(appSource, /ticketSummary\.body/);
    assert.match(appSource, /ticketSummary\.status/);
    assert.doesNotMatch(appSource, /<pre|<code|JSON\.stringify\(runtimeState|JSON\.stringify\(ticketSummary/);
    assert.doesNotMatch(appSource, /ticket_id|key_version|hmac_algorithm|secret_hmac/);
  });

  it('implements the Dr. Oetker quiz-to-spin flow through backend runtime endpoints', () => {
    assert.match(appSource, /drOetkerManifest/);
    assert.match(appSource, /language-switch/);
    assert.match(appSource, /selectLanguage\('fr-BE'\)/);
    assert.match(appSource, /selectLanguage\('nl-BE'\)/);
    assert.match(appSource, /submitQuizAnswer\(\{ language, choice_id: choiceId \}\)/);
    assert.match(appSource, /startSpin\(\)/);
    assert.match(appSource, /quiz_passed === true/);
    assert.match(clientSource, /'\/quiz\/answer'/);
    assert.match(clientSource, /'\/spin\/start'/);
  });

  it('keeps the Dr. Oetker quiz copy reactive to pre-answer language switches', () => {
    assert.match(appSource, /\$: language = activeLanguage\(runtimeState, selectedLanguage\);/);
    assert.match(appSource, /function activeLanguage\(state: RuntimeState \| null = runtimeState, fallbackLanguage: CampaignLocale = selectedLanguage\)/);
    assert.match(appSource, /postPresentation\(\{ action: 'idle', label: localized\(drOetkerManifest\.quiz\.question, nextLanguage\) \}\)/);
    for (const expectedNlCopy of [
      'Welk product hoort bij een Dr. Oetker pizza?',
      'Een Ristorante pizza',
      'Een frisdrank',
      'Wascapsules',
      'Draai',
      'Juist antwoord. Draai aan het wiel.',
    ]) {
      assert.ok(appSource.includes(expectedNlCopy) || fixtureSource.includes(expectedNlCopy), `missing NL copy ${expectedNlCopy}`);
    }
  });

  it('maps backend-selected outcomes to presentation wheel segments without frontend prize authority', () => {
    assert.match(fixtureSource, /visual_wheel/);
    assert.match(fixtureSource, /segmentIndexForOutcome/);
    assert.match(appSource, /segmentIndexForOutcome\(outcomeId/);
    assert.match(appSource, /type: 'presentation'/);
    assert.doesNotMatch(fixtureSource, /createTicket|Math\.random\(\) \*/);
    assert.doesNotMatch(appSource, /ticket_code|createTicket|qr_payload_template\.replaceAll|Math\.random\(\) \*/);
  });

  it('keeps Dr. Oetker result reveal scoped to the current run and auto-resets to idle', () => {
    assert.match(appSource, /const resultRevealResetMs = 12_000/);
    assert.match(appSource, /let resultResetTimer: ReturnType<typeof setTimeout> \| null = null/);
    assert.match(appSource, /function setReveal\(nextReveal: Reveal \| null\)/);
    assert.match(appSource, /setTimeout\(resetToIdlePresentation, resultRevealResetMs\)/);
    assert.match(appSource, /clearResultResetTimer\(\);\n\s+unsubscribe\(\);/);
    assert.match(appSource, /ticketSummary = customerTicketSummary\(reveal\?\.ticket \?\? null, reveal\)/);
    assert.doesNotMatch(appSource, /ticketSummary = customerTicketSummary\(runtimeState\?\.latest_ticket/);
    assert.match(appSource, /ticket: null,\n\s+\}\);/);
    assert.match(appSource, /ticket: response\.ticket \?\? null/);
    assert.match(appSource, /postPresentation\(\{ action: 'idle', label: localized\(drOetkerManifest\.quiz\.question, activeLanguage\(\)\) \}\)/);
  });

  it('mounts the package bridge only as an iframe action and destroys it on iframe removal', () => {
    assert.match(appSource, /function packageBridge\(node: HTMLIFrameElement\)/);
    assert.match(appSource, /destroyBridge\(\)/);
    assert.match(appSource, /use:packageBridge/);
    assert.match(appSource, /getRuntimeState: \(\) => runtimeState/);
  });

  it('defaults runtime access to the serving origin with a localhost fallback', () => {
    assert.match(clientSource, /window\.location\?\.origin/);
    assert.match(clientSource, /http:\/\/127\.0\.0\.1:8787/);
    assert.doesNotMatch(clientSource, /127\.0\.0\.1:3377/);
  });

  it('keeps runtime access in the parent client rather than the package fixture', () => {
    assert.match(clientSource, /fetchImpl\(.*\$\{config\.baseUrl\}/s);
    assert.match(clientSource, /new webSocketImpl\(url\)/);
    assert.doesNotMatch(fixtureSource, /\bfetch\s*\(/);
    assert.doesNotMatch(fixtureSource, /new\s+WebSocket\b/);
    assert.doesNotMatch(fixtureSource, /XMLHttpRequest/);
    assert.doesNotMatch(fixtureSource, /JSON\.stringify\(result/);
    assert.match(fixtureSource, /parent\.postMessage/);
  });

  it('validates postMessage source, origin, protocol, request id, method, capability, and session state', () => {
    for (const marker of [
      'event.source !== iframe.contentWindow',
      "event.origin !== 'null'",
      'protocol_mismatch',
      'invalid_request_id',
      'unknown_method',
      'capability_not_allowed',
      'session_not_ready_for_print',
    ]) {
      assert.ok(bridgeSource.includes(marker), `missing bridge guard ${marker}`);
    }
  });
});
