/// <reference types="vite/client" />
import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, Texture, type TextStyleOptions } from 'pixi.js';
import gsap from 'gsap';

type KioskState = 'idle' | 'scan' | 'member' | 'spinning' | 'printing' | 'printed';

type CoinPayload = {
  joke?: string;
  source?: string;
  scan?: string;
  free?: boolean;
  memberName?: string;
};

type SceneHandles = {
  app: Application;
  wheel: Container;
  statusText: Text;
  jokeText: Text;
  scanText: Text;
  memberText: Text;
  flatLion: Container;
  plushLion: Container;
  particles: Container;
  resize: () => void;
};

const jokes = [
  'Why did the lion open a kiosk? For the mane income.',
  'A coin went into the jungle. It came out with exact pride.',
  'The scanner asked the lion for ID. The lion said: roar code.',
  'Today your fortune is crisp paper and questionable humor.',
  'The wheel says: you win one premium dad joke.',
  "A tiny lion walks into a shop. Everyone says: P'tit cash?",
  'Your receipt is legally binding in the kingdom of nonsense.',
  'The printer is not laughing. It is thermally amused.',
];

const hardwareBase =
  import.meta.env.VITE_HARDWARE_URL ?? (import.meta.env.DEV ? 'http://localhost:8787' : '');

function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneHandles | null>(null);
  const timersRef = useRef<number[]>([]);
  const [state, setState] = useState<KioskState>('idle');
  const [lastScan, setLastScan] = useState('');
  const [memberMessage, setMemberMessage] = useState('');
  const [currentJoke, setCurrentJoke] = useState(jokes[0]);
  const [connected, setConnected] = useState(false);

  const statusLabel = useMemo(() => {
    if (!connected) return 'LOCAL PREVIEW';
    if (state === 'member') return 'MEMBER CARD';
    if (state === 'spinning') return 'WHEEL SPINNING';
    if (state === 'printing') return 'PRINTING TICKET';
    if (state === 'printed') return 'TICKET SENT';
    if (state === 'scan') return 'SCAN RECEIVED';
    return 'INSERT COIN OR SCAN CARD';
  }, [connected, state]);

  useEffect(() => {
    let cancelled = false;

    async function bootScene() {
      if (!stageRef.current) return;
      const app = new Application();
      await app.init({
        resizeTo: stageRef.current,
        antialias: true,
        backgroundAlpha: 0,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (cancelled || !stageRef.current) {
        app.destroy(true);
        return;
      }

      stageRef.current.appendChild(app.canvas);
      sceneRef.current = await createScene(app);
    }

    bootScene();
    return () => {
      cancelled = true;
      sceneRef.current?.app.destroy(true, { children: true });
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => clearSessionTimers(timersRef.current);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.statusText.text = statusLabel;
    scene.jokeText.text = currentJoke;
    scene.scanText.text = lastScan ? `SCAN ${lastScan}` : 'SCAN -';
    scene.memberText.text = memberMessage;
  }, [currentJoke, lastScan, memberMessage, statusLabel]);

  useEffect(() => {
    if (!window.EventSource) return;
    const events = new EventSource(`${hardwareBase}/events`);
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    events.addEventListener('scan', (event) => {
      const payload = JSON.parse(event.data || '{}');
      setLastScan(payload.payload || '');
      setState('scan');
      playBeep();
      window.setTimeout(() => setState((current) => (current === 'scan' ? 'idle' : current)), 900);
    });
    events.addEventListener('member', (event) => {
      const payload = JSON.parse(event.data || '{}');
      const message = payload.message || `Hi ${payload.name || 'member'}, how are you?`;
      setMemberMessage(message);
      setLastScan(payload.payload || '');
      setState('member');
      speak(message);
    });
    events.addEventListener('coin', (event) => {
      triggerSpin(JSON.parse(event.data || '{}'));
    });
    events.addEventListener('printer', (event) => {
      const payload = JSON.parse(event.data || '{}');
      if (payload.ok) setState('printed');
    });
    return () => events.close();
  }, []);

  function triggerSpin(payload: CoinPayload = {}) {
    clearSessionTimers(timersRef.current);
    const joke = payload.joke || jokes[Math.floor(Math.random() * jokes.length)];
    setCurrentJoke(joke);
    setLastScan(payload.scan || lastScan);
    if (payload.free && payload.memberName) {
      setMemberMessage(`Hi ${payload.memberName}, how are you? Member spin: no coin needed.`);
    }
    setState('spinning');
    spinWheel(sceneRef.current, Boolean(payload.free));
    timersRef.current.push(window.setTimeout(() => setState('printing'), 3600));
    timersRef.current.push(window.setTimeout(() => setState('idle'), 6200));
  }

  return (
    <main className="kiosk-shell">
      <div ref={stageRef} className="pixi-stage" />
      <section className="hud" aria-live="polite">
        <div>
          <p className="eyebrow">P&apos;TIT LION</p>
          <h1>Fortune Machine</h1>
        </div>
        <div className="hud-status">{statusLabel}</div>
      </section>
      <section className="ticket-panel">
        <p className="ticket-label">{state === 'member' || memberMessage ? 'Member Fortune' : 'Thermal Fortune'}</p>
        <p className="ticket-joke">{currentJoke}</p>
        {lastScan && <p className="ticket-scan">SCAN {lastScan}</p>}
      </section>
      {memberMessage && <div className="member-banner">{memberMessage}</div>}
      <button className="demo-button" type="button" onClick={() => triggerSpin()}>
        Demo Spin
      </button>
    </main>
  );
}

function clearSessionTimers(timers: number[]) {
  while (timers.length) {
    window.clearTimeout(timers.pop());
  }
}

async function createScene(app: Application): Promise<SceneHandles> {
  const root = new Container();
  app.stage.addChild(root);

  const background = new Graphics();
  const wheel = new Container();
  const flatLion = drawFlatLion();
  const plushLion = drawPlushLion();
  const particles = new Container();
  const statusText = new Text({ text: 'INSERT COIN OR SCAN CARD', style: textStyle(24, 900, '#9c0d31') });
  const jokeText = new Text({ text: jokes[0], style: textStyle(24, 800, '#4a1022', 440) });
  const scanText = new Text({ text: 'SCAN -', style: textStyle(15, 800, '#9c0d31') });
  const memberText = new Text({ text: '', style: textStyle(20, 900, '#4a1022', 620) });

  root.addChild(background, particles, wheel, plushLion, flatLion);
  drawWheel(wheel);

  let logoTexture = Texture.EMPTY;
  try {
    logoTexture = await Assets.load('/assets/delhaize-bicolor-logo.png');
  } catch {
    logoTexture = Texture.EMPTY;
  }
  if (logoTexture !== Texture.EMPTY) {
    const logo = new Sprite(logoTexture);
    logo.anchor.set(0.5);
    logo.scale.set(0.18);
    root.addChild(logo);
    app.ticker.add(() => {
      logo.x = app.screen.width - 112;
      logo.y = app.screen.height - 156;
    });
  }

  const resize = () => {
    const width = app.screen.width;
    const height = app.screen.height;
    background.clear();
    background.fill('#f4abc2');
    background.rect(0, 0, width, height);
    background.fill();
    background.fill('rgba(255,255,255,0.18)');
    for (let i = 0; i < 26; i += 1) {
      background.circle((i * 157) % width, 80 + ((i * 89) % Math.max(160, height - 160)), 3 + (i % 4));
    }
    background.fill();
    background.fill('rgba(157,13,49,0.09)');
    background.rect(0, height * 0.82, width, height * 0.18);
    background.fill();

    wheel.x = width * 0.68;
    wheel.y = height * 0.53;
    wheel.scale.set(Math.min(width, height) / 760);
    plushLion.x = width * 0.36;
    plushLion.y = height * 0.59;
    plushLion.scale.set(Math.min(width, height) / 700);
    flatLion.y = 95;
    statusText.x = 58;
    statusText.y = 166;
    jokeText.x = 64;
    jokeText.y = height * 0.66;
    scanText.x = 64;
    scanText.y = height * 0.79;
    memberText.x = Math.max(40, width * 0.18);
    memberText.y = height * 0.23;
  };

  resize();
  app.renderer.on('resize', resize);

  app.ticker.add((ticker) => {
    const t = performance.now();
    flatLion.x = app.screen.width - 265 + Math.sin(t * 0.0014) * 96;
    flatLion.scale.x = Math.sin(t * 0.0014) > 0 ? -1 : 1;
    flatLion.children.forEach((child, index) => {
      if (child instanceof Graphics && index > 4) child.rotation = Math.sin(t * 0.007 + index) * 0.08;
    });
    plushLion.rotation = Math.sin(t * 0.0018) * 0.025;
    if (!gsap.isTweening(wheel)) wheel.rotation += 0.004 * ticker.deltaTime;
  });

  return { app, wheel, statusText, jokeText, scanText, memberText, flatLion, plushLion, particles, resize };
}

function drawWheel(target: Container) {
  const segments = ['#ffd85a', '#f0345d', '#0fa3a3', '#fff3cc', '#2b6dd8', '#16a05d', '#ff8baa', '#ffffff'];
  const radius = 190;
  segments.forEach((color, index) => {
    const start = (index / segments.length) * Math.PI * 2;
    const end = ((index + 1) / segments.length) * Math.PI * 2;
    const points = [0, 0];
    for (let step = 0; step <= 12; step += 1) {
      const angle = start + ((end - start) * step) / 12;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    const segment = new Graphics();
    segment.fill(color);
    segment.poly(points);
    segment.fill();
    target.addChild(segment);
  });
  const rim = new Graphics();
  rim.stroke({ color: '#9c0d31', width: 12 });
  rim.circle(0, 0, radius);
  rim.stroke();
  target.addChild(rim);

  const hub = new Graphics();
  hub.fill('#ffffff');
  hub.circle(0, 0, 34);
  hub.fill();
  hub.stroke({ color: '#9c0d31', width: 5 });
  hub.circle(0, 0, 34);
  hub.stroke();
  target.addChild(hub);
}

function spinWheel(scene: SceneHandles | null, free: boolean) {
  if (!scene) return;
  scene.particles.removeChildren();
  for (let i = 0; i < 34; i += 1) {
    const dot = new Graphics();
    dot.fill(i % 2 ? '#ffd85a' : '#ffffff');
    dot.circle(0, 0, 4 + Math.random() * 5);
    dot.fill();
    dot.x = scene.app.screen.width * 0.68;
    dot.y = scene.app.screen.height * 0.53;
    scene.particles.addChild(dot);
    gsap.to(dot, {
      x: dot.x + (Math.random() - 0.5) * 520,
      y: dot.y + (Math.random() - 0.5) * 420,
      alpha: 0,
      duration: 1.1 + Math.random() * 0.7,
      ease: 'power2.out',
      onComplete: () => dot.destroy(),
    });
  }
  gsap.to(scene.wheel, {
    rotation: scene.wheel.rotation + Math.PI * (free ? 12 : 10) + Math.random() * Math.PI,
    duration: 3.5,
    ease: 'power4.out',
  });
}

function drawFlatLion() {
  const lion = new Container();
  const body = new Graphics();
  body.fill('#d91748');
  body.poly([-62, 22, -28, -24, 44, -24, 62, -8, 56, 38, 22, 34, -2, 44, -42, 42]);
  body.fill();
  lion.addChild(body);

  const head = new Graphics();
  head.fill('#d91748');
  head.poly([-72, -18, -104, -6, -74, 10, -92, 34, -54, 20, -48, -10]);
  head.fill();
  lion.addChild(head);

  const tail = new Graphics();
  tail.fill('#d91748');
  tail.rect(18, -48, 70, 14);
  tail.rect(76, -48, 13, 50);
  tail.rect(28, -36, 48, 10);
  tail.fill();
  lion.addChild(tail);

  for (const [x1, y1, x2, y2] of [
    [-36, 36, -54, 72],
    [-10, 36, -4, 73],
    [28, 34, 12, 72],
    [52, 32, 67, 70],
  ]) {
    const leg = new Graphics();
    leg.stroke({ color: '#d91748', width: 14, cap: 'round' });
    leg.moveTo(x1, y1);
    leg.lineTo(x2, y2);
    leg.stroke();
    lion.addChild(leg);
  }
  return lion;
}

function drawPlushLion() {
  const lion = new Container();
  const mane = new Graphics();
  mane.fill('#d91748');
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    mane.moveTo(Math.cos(a - 0.09) * 78, Math.sin(a - 0.09) * 78 - 50);
    mane.lineTo(Math.cos(a) * 112, Math.sin(a) * 112 - 50);
    mane.lineTo(Math.cos(a + 0.09) * 78, Math.sin(a + 0.09) * 78 - 50);
  }
  mane.fill();
  lion.addChild(mane);

  const body = new Graphics();
  body.fill('#f0345d');
  body.ellipse(0, 42, 68, 88);
  body.circle(0, -44, 82);
  body.fill();
  body.fill('#151116');
  body.circle(-28, -56, 10);
  body.circle(28, -56, 10);
  body.fill();
  body.fill('#3b2630');
  body.poly([-12, -32, 0, -43, 13, -32, 0, -22]);
  body.fill();
  lion.addChild(body);

  const paw = new Graphics();
  paw.stroke({ color: '#f0345d', width: 24, cap: 'round' });
  paw.moveTo(58, 22);
  paw.quadraticCurveTo(112, -16, 158, -6);
  paw.stroke();
  lion.addChild(paw);
  return lion;
}

function textStyle(size: number, weight: number, color: string, width?: number): TextStyleOptions {
  return {
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    fontSize: size,
    fontWeight: String(weight) as TextStyleOptions['fontWeight'],
    fill: color,
    wordWrap: Boolean(width),
    wordWrapWidth: width,
  };
}

let audioContext: AudioContext | null = null;

function playBeep() {
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = 1320;
  oscillator.type = 'triangle';
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.14);
}

function speak(message: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.96;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

export default App;
