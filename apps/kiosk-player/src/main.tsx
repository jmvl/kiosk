import React from 'react';
import { createRoot } from 'react-dom/client';
import { KioskPlayerApp } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <React.StrictMode>
    <KioskPlayerApp />
  </React.StrictMode>,
);

export { KioskPlayerApp } from './App.js';
export { createRuntimeClient, runtimeConfigFromEnv } from './runtime-client.js';
export { mountPackageBridge, validateBridgeRequest, bridgeProtocol } from './package-bridge.js';
