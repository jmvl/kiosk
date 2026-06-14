import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import packageJson from '../package.json' with { type: 'json' };

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../src/package-bridge.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../src/runtime-client.ts', import.meta.url), 'utf8');
const fixtureSource = readFileSync(new URL('../src/demo-package.ts', import.meta.url), 'utf8');

const domGlobals = [
  'window',
  'document',
  'HTMLElement',
  'HTMLIFrameElement',
  'Event',
  'MessageEvent',
  'MouseEvent',
  'Node',
  'navigator',
  'location',
  'CustomEvent',
];

let activeViteServer;
let activeRoot;
let restoreGlobals = () => {};

afterEach(async () => {
  activeRoot?.unmount();
  activeRoot = undefined;
  await activeViteServer?.close();
  activeViteServer = undefined;
  restoreGlobals();
  restoreGlobals = () => {};
});

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://127.0.0.1:4173/',
    pretendToBeVisual: true,
  });
  const previous = new Map();
  for (const key of domGlobals) {
    previous.set(key, globalThis[key]);
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: dom.window[key],
    });
  }
  restoreGlobals = () => {
    dom.window.close();
    for (const [key, value] of previous) {
      if (value === undefined) {
        Reflect.deleteProperty(globalThis, key);
      } else {
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
      }
    }
  };
  return dom;
}

function runtimeState(sessionState = null, mode = 'idle', latestTicket = null, sessionId = 'session-test') {
  return {
    runtime: {
      kiosk_id: 'HQ001',
      mode,
      current_session_id: sessionState ? sessionId : null,
      active_package_id: 'chocomel-spin-win',
      active_package_version: '1.0.0',
      local_sequence: sessionState ? 2 : 1,
      last_heartbeat_at: null,
      last_error: null,
      updated_at: new Date(0).toISOString(),
    },
    current_session: sessionState
      ? {
          session_id: sessionId,
          state: sessionState,
          package_id: 'chocomel-spin-win',
          package_version: '1.0.0',
          token_amount_cents: 100,
          started_at: new Date(0).toISOString(),
          completed_at: null,
          result_payload: null,
          ticket_code: null,
        }
      : null,
    latest_ticket: latestTicket,
    adapters: { token: { fake: true }, printer: { fake: true } },
  };
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

async function waitFor(assertion, timeoutMs = 1000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      return assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

describe('@retail-kiosk/kiosk-player package', () => {
  it('declares React/Vite build, typecheck, and test scripts', () => {
    assert.equal(packageJson.name, '@retail-kiosk/kiosk-player');
    assert.match(packageJson.scripts.build, /vite build/);
    assert.equal(packageJson.scripts.typecheck, 'tsc -p tsconfig.json --noEmit');
    assert.equal(packageJson.scripts.test, 'node --test test/*.test.mjs');
    assert.ok(packageJson.dependencies.react);
    assert.ok(packageJson.dependencies.vite);
  });

  it('contains the required customer screens and iframe sandbox', () => {
    for (const marker of ['screen === \'idle\'', 'screen === \'game\'', 'screen === \'result\'', 'screen === \'maintenance\'', 'screen === \'error\'']) {
      assert.ok(appSource.includes(marker), `missing ${marker}`);
    }
    assert.match(appSource, /sandbox="allow-scripts allow-forms"/);
    assert.doesNotMatch(appSource, /allow-same-origin/);
  });

  it('keeps normal player mode customer-safe with no raw tickets or debug controls', async () => {
    installDom();
    const internalTicket = {
      ticket_id: 'ticket-internal-123',
      ticket_code: 'CHOCO-WIN',
      session_id: 'session-secret-456',
      public_ticket_id: 'public-ticket-789',
      key_version: 'kiosk-key-v1',
      hmac_algorithm: 'HMAC-SHA-256',
      render_payload: {
        title: 'Free Chocomel',
        body: 'Show your printed ticket to staff.',
        secret_hmac: 'hmac-secret-do-not-render',
      },
      print_status: 'printed',
      created_at: new Date(0).toISOString(),
    };

    globalThis.fetch = async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === '/state') return jsonResponse(runtimeState('completed', 'idle', internalTicket));
      throw new Error(`unexpected runtime request ${path}`);
    };
    globalThis.WebSocket = class FakeWebSocket {
      addEventListener() {}
      close() {}
    };

    activeViteServer = await createServer({
      root: new URL('..', import.meta.url).pathname,
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const [{ createElement, act }, { createRoot }, { KioskPlayerApp }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      activeViteServer.ssrLoadModule('/src/App.tsx'),
    ]);

    activeRoot = createRoot(document.getElementById('root'));
    await act(async () => {
      activeRoot.render(createElement(KioskPlayerApp));
    });

    await waitFor(() => assert.ok(document.querySelector('.screen-result')));
    const text = document.body.textContent;
    assert.match(text, /Free Chocomel/);
    assert.match(text, /printed/);
    assert.equal(document.querySelector('pre'), null, 'customer player must not render raw JSON in <pre>');
    assert.equal(document.querySelector('code'), null, 'customer player must not render raw JSON in <code>');
    assert.doesNotMatch(text, /ticket-internal-123|session-secret-456|HMAC-SHA-256|hmac-secret-do-not-render|key_version|render_payload/);
    assert.doesNotMatch(text, /fake token|enter maintenance|exit maintenance/i);
  });

  it('keeps normal playing mode customer-safe with no raw session identifiers', async () => {
    installDom();

    globalThis.fetch = async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === '/state') return jsonResponse(runtimeState('playing', 'idle', null, 'session-secret-456'));
      throw new Error(`unexpected runtime request ${path}`);
    };
    globalThis.WebSocket = class FakeWebSocket {
      addEventListener() {}
      close() {}
    };

    activeViteServer = await createServer({
      root: new URL('..', import.meta.url).pathname,
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const [{ createElement, act }, { createRoot }, { KioskPlayerApp }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      activeViteServer.ssrLoadModule('/src/App.tsx'),
    ]);

    activeRoot = createRoot(document.getElementById('root'));
    await act(async () => {
      activeRoot.render(createElement(KioskPlayerApp));
    });

    await waitFor(() => assert.ok(document.querySelector('.screen-game')));
    const text = document.body.textContent;
    assert.match(text, /Activation active/);
    assert.equal(document.querySelector('.session-list'), null, 'customer player must not render HQ debug session diagnostics');
    assert.doesNotMatch(text, /session-secret-456/);
    assert.doesNotMatch(text, /HQ debug|fake token|enter maintenance|exit maintenance/i);
  });

  it('mounts the package bridge after the game iframe appears and cleans it up on screen transition when HQ debug controls are enabled', async () => {
    installDom();

    const messageListeners = [];
    const removedMessageListeners = [];
    const originalAddEventListener = window.addEventListener.bind(window);
    const originalRemoveEventListener = window.removeEventListener.bind(window);
    window.addEventListener = (type, listener, options) => {
      if (type === 'message') messageListeners.push(listener);
      return originalAddEventListener(type, listener, options);
    };
    window.removeEventListener = (type, listener, options) => {
      if (type === 'message') removedMessageListeners.push(listener);
      return originalRemoveEventListener(type, listener, options);
    };

    const requests = [];
    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(String(url)).pathname;
      requests.push({ path, method: init.method ?? 'GET' });
      if (path === '/state') return jsonResponse(runtimeState());
      if (path === '/dev/token') return jsonResponse({ state: runtimeState('playing') });
      if (path === '/maintenance/enter') return jsonResponse({ state: runtimeState(null, 'maintenance') });
      throw new Error(`unexpected runtime request ${path}`);
    };
    globalThis.WebSocket = class FakeWebSocket {
      constructor(url) {
        this.url = url;
      }
      addEventListener() {}
      close() {}
    };

    activeViteServer = await createServer({
      root: new URL('..', import.meta.url).pathname,
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
      define: { 'import.meta.env.VITE_KIOSK_PLAYER_HQ_DEBUG_CONTROLS': JSON.stringify('true') },
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const [{ createElement, act }, { createRoot }, { KioskPlayerApp }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      activeViteServer.ssrLoadModule('/src/App.tsx'),
    ]);

    activeRoot = createRoot(document.getElementById('root'));
    await act(async () => {
      activeRoot.render(createElement(KioskPlayerApp));
    });

    await waitFor(() => assert.ok(document.querySelector('.screen-idle button.primary')));
    assert.match(document.body.textContent, /HQ debug controls/);
    assert.equal(messageListeners.length, 0, 'bridge must not mount before the package iframe exists');

    await act(async () => {
      document.querySelector('.screen-idle button.primary').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => assert.ok(document.querySelector('iframe.package-frame')));
    await waitFor(() => assert.equal(messageListeners.length, 1));
    assert.deepEqual(requests.map((request) => request.path), ['/state', '/dev/token']);

    const enterMaintenanceButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'HQ debug: enter maintenance');
    assert.ok(enterMaintenanceButton);
    await act(async () => {
      enterMaintenanceButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => assert.ok(document.querySelector('.screen-maintenance')));
    assert.equal(document.querySelector('iframe.package-frame'), null);
    await waitFor(() => assert.equal(removedMessageListeners.length, 1));
    assert.equal(removedMessageListeners[0], messageListeners[0]);
    assert.deepEqual(requests.map((request) => request.path), ['/state', '/dev/token', '/maintenance/enter']);

    await act(async () => {
      activeRoot.unmount();
    });
    activeRoot = undefined;
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
