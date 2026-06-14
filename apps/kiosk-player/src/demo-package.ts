export const chocomelManifest = {
  package_id: 'chocomel-wheel',
  version: '1.0.0',
  display_name: 'Chocomel Prize Wheel',
  bridge_capabilities: ['recordTelemetry', 'requestPrint', 'complete', 'fail', 'getScheduleContext', 'getRuntimeCapabilities'],
} as const;

export const demoPackageHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Chocomel Prize Wheel Demo Package</title>
<style>
  :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background:#2b1404; color:#fff6df; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; overflow:hidden; }
  main { box-sizing:border-box; width:min(86vw, 900px); max-height:calc(100vh - 32px); display:grid; place-items:center; align-content:center; text-align:center; padding:clamp(16px, 3vh, 32px); border-radius:36px; background:radial-gradient(circle at 50% 10%, #ffdc65, #a95511 42%, #411901 100%); box-shadow:0 30px 90px #0008; }
  h1 { font-size:clamp(36px, 7vw, 84px); margin:0 0 8px; letter-spacing:-0.07em; }
  p { font-size:clamp(16px, 2.5vw, 28px); margin:8px auto; max-width:720px; }
  button { margin-top:clamp(12px, 2vh, 20px); font-size:clamp(22px, 4vw, 32px); border:0; border-radius:999px; padding:clamp(16px, 2.5vh, 24px) clamp(28px, 5vw, 42px); color:#3c1600; background:#ffe784; font-weight:900; box-shadow:0 14px 0 #7b3407; cursor:pointer; }
  button:active { transform:translateY(8px); box-shadow:0 6px 0 #7b3407; }
  .wheel { width:clamp(120px, 28vh, 240px); height:clamp(120px, 28vh, 240px); margin:clamp(8px, 1.5vh, 16px) auto clamp(12px, 2vh, 22px); border-radius:50%; background:conic-gradient(#ffe784 0 60deg,#8b3b09 60deg 120deg,#fff 120deg 180deg,#d1620d 180deg 240deg,#ffe784 240deg 300deg,#8b3b09 300deg 360deg); border:14px solid #3c1600; animation:spin 5s cubic-bezier(.2,.8,.2,1) infinite; }
  @keyframes spin { 0%{transform:rotate(0deg)} 70%,100%{transform:rotate(730deg)} }
</style>
</head>
<body>
<main>
  <div class="wheel" aria-hidden="true"></div>
  <h1>Chocomel Spin</h1>
  <p id="status">Tap the prize button. The package talks only to the player bridge.</p>
  <button id="claim" type="button">Claim fake prize</button>
</main>
<script>
(() => {
  const protocol = 'retail-kiosk-package-bridge/v1';
  let sequence = 0;
  const pending = new Map();
  function bridge(method, payload) {
    const id = 'demo-' + (++sequence);
    parent.postMessage({ protocol, type: 'request', id, method, payload }, '*');
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.protocol !== protocol || message.type !== 'response') return;
    const callbacks = pending.get(message.id);
    if (!callbacks) return;
    pending.delete(message.id);
    message.ok ? callbacks.resolve(message.result) : callbacks.reject(new Error(message.error || 'bridge_error'));
  });
  bridge('recordTelemetry', { event: 'package_loaded' }).catch(() => {});
  document.getElementById('claim').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.textContent = 'Requesting ticket through parent bridge…';
    try {
      await bridge('requestPrint', { result: { prize: 'Free Chocomel', tier: 'demo' }, ticket: { prize: 'Free Chocomel', headline: 'Chocomel HQ Demo' } });
      await bridge('complete', { result: 'printed_demo_ticket' });
      status.textContent = 'Prize ticket accepted by runtime. Please collect your printed ticket.';
    } catch (error) {
      await bridge('fail', { message: String(error && error.message || error) }).catch(() => {});
      status.textContent = 'Bridge rejected the request: ' + String(error && error.message || error);
    }
  });
})();
</script>
</body>
</html>`;
