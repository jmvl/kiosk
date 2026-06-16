import { mount } from 'svelte';
import KioskPlayerApp from './App.svelte';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

mount(KioskPlayerApp, { target: root });

export { default as KioskPlayerApp } from './App.svelte';
export { createRuntimeClient, runtimeConfigFromEnv } from './runtime-client.js';
export { mountPackageBridge, validateBridgeRequest, bridgeProtocol } from './package-bridge.js';
