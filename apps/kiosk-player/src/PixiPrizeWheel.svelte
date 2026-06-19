<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Application, Container, Graphics, Text } from 'pixi.js';
  import { gsap } from 'gsap';
  import type { CampaignLocale, VisualWheelSegment } from './demo-package.js';
  import { localized } from './demo-package.js';

  export let segments: readonly VisualWheelSegment[] = [];
  export let locale: CampaignLocale = 'fr-BE';
  export let targetSegmentIndex = 0;
  export let spinNonce = 0;
  export let spinning = false;
  export let statusLabel = 'Concours · Wedstrijd';

  const wheelSize = 660;
  const center = wheelSize / 2;
  const radius = 300;
  const labelRadius = 218;
  const sectorCount = 20;
  const colors = [0xf7d37f, 0xfff1d5, 0xd84624, 0xf5ba62, 0x2f7d32, 0xfffaf0, 0xa8321d, 0xffdf8a, 0xffffff, 0x3e8c43];

  let host: HTMLDivElement;
  let app: Application | null = null;
  let wheel: Container | null = null;
  let ready = false;
  let lastSpinNonce = 0;
  let lastSpinning = false;
  let currentRotation = 0;
  let activeTween: gsap.core.Tween | null = null;
  let loopTween: gsap.core.Tween | null = null;

  $: if (ready && spinning !== lastSpinning) {
    lastSpinning = spinning;
    setFreeSpin(spinning);
  }

  $: if (ready && spinNonce !== lastSpinNonce) {
    lastSpinNonce = spinNonce;
    if (spinNonce > 0) spinTo(targetSegmentIndex);
  }

  onMount(() => {
    let cancelled = false;

    async function boot() {
      const nextApp = new Application();
      await nextApp.init({
        width: wheelSize,
        height: wheelSize,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (cancelled) {
        nextApp.destroy(true);
        return;
      }
      app = nextApp;
      host.appendChild(nextApp.canvas);
      drawWheel();
      ready = true;
      lastSpinNonce = spinNonce;
    }

    boot().catch((error) => {
      console.error('pixi_wheel_init_failed', error);
    });

    return () => {
      cancelled = true;
      activeTween?.kill();
      loopTween?.kill();
      app?.destroy(true, { children: true, texture: true });
      app = null;
      wheel = null;
    };
  });

  onDestroy(() => {
    activeTween?.kill();
    loopTween?.kill();
  });

  function drawWheel() {
    if (!app) return;
    app.stage.removeChildren();

    const nextWheel = new Container();
    nextWheel.pivot.set(center, center);
    nextWheel.position.set(center, center);
    nextWheel.rotation = currentRotation;

    const sourceCount = Math.max(segments.length, 1);
    const radiansPerSector = (Math.PI * 2) / sectorCount;
    const graphic = new Graphics();

    for (let index = 0; index < sectorCount; index += 1) {
      const start = index * radiansPerSector - Math.PI / 2 - radiansPerSector / 2;
      const end = start + radiansPerSector;
      graphic
        .moveTo(center, center)
        .arc(center, center, radius, start, end)
        .lineTo(center, center)
        .fill(colors[index % colors.length])
        .stroke({ width: 5, color: 0xffffff, alpha: 1 });
    }

    const outerRing = new Graphics()
      .circle(center, center, radius + 16)
      .stroke({ width: 26, color: 0xd84624, alpha: 1 })
      .circle(center, center, radius - 38)
      .stroke({ width: 12, color: 0xfff8ec, alpha: 0.95 });

    const hub = new Graphics()
      .circle(center, center, 76)
      .fill(0xfff8ec)
      .circle(center, center, 54)
      .stroke({ width: 12, color: 0xd84624, alpha: 1 })
      .circle(center, center, 24)
      .fill(0x2f7d32);

    nextWheel.addChild(graphic, outerRing);

    for (let index = 0; index < sectorCount; index += 1) {
      const segment = segments[index % sourceCount];
      const angle = index * radiansPerSector - Math.PI / 2;
      const label = localized(segment?.localized_label, locale).replace('€ ', '€\n');
      const text = new Text({
        text: label,
        style: {
          fill: '#321407',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 24,
          fontWeight: '900',
          align: 'center',
          wordWrap: true,
          wordWrapWidth: 128,
          lineHeight: 25,
          dropShadow: { color: '#fff8ec', blur: 4, angle: 0, distance: 1, alpha: 0.9 },
        },
      });
      text.anchor.set(0.5);
      text.x = center + labelRadius * Math.cos(angle);
      text.y = center + labelRadius * Math.sin(angle);
      text.rotation = angle + Math.PI / 2;
      if (text.rotation > Math.PI / 2 && text.rotation < Math.PI * 1.5) text.rotation += Math.PI;
      nextWheel.addChild(text);
    }

    nextWheel.addChild(hub);
    app.stage.addChild(nextWheel);
    wheel = nextWheel;
  }

  function setFreeSpin(enabled: boolean) {
    loopTween?.kill();
    loopTween = null;
    if (!enabled || !wheel || activeTween) return;
    loopTween = gsap.to(wheel, {
      rotation: currentRotation + Math.PI * 2,
      duration: 1.15,
      ease: 'none',
      repeat: -1,
      onUpdate: () => { currentRotation = wheel?.rotation ?? currentRotation; },
    });
  }

  function sectorForSegmentIndex(index: number): number {
    const sourceIndex = ((index % segments.length) + segments.length) % segments.length;
    const outcomeId = segments[sourceIndex]?.outcome_id;
    const matches = Array.from({ length: sectorCount }, (_, sector) => sector)
      .filter((sector) => segments[sector % segments.length]?.outcome_id === outcomeId);
    return matches[spinNonce % Math.max(matches.length, 1)] ?? sourceIndex;
  }

  function spinTo(index: number) {
    if (!wheel || !segments.length) return;
    const radiansPerSector = (Math.PI * 2) / sectorCount;
    const targetSector = sectorForSegmentIndex(index);
    const stopRotation = Math.PI / 2 - (targetSector * radiansPerSector);
    const currentModulo = ((currentRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const stopModulo = ((stopRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const delta = (stopModulo - currentModulo + Math.PI * 2) % (Math.PI * 2);
    const target = currentRotation + (Math.PI * 2 * 4) + delta;

    activeTween?.kill();
    loopTween?.kill();
    loopTween = null;
    activeTween = gsap.to(wheel, {
      rotation: target,
      duration: 4.8,
      ease: 'power4.out',
      onUpdate: () => { currentRotation = wheel?.rotation ?? currentRotation; },
      onComplete: () => {
        currentRotation = target;
        activeTween = null;
      },
    });
  }
</script>

<div class="pixi-wheel-card" aria-label="Dr. Oetker Pizza Wheel presentation">
  <div class="wheel-pointer" aria-hidden="true"></div>
  <div bind:this={host} class="pixi-wheel-host" aria-hidden="true"></div>
  <div class="wheel-caption">
    <strong>Pizza Wheel</strong>
    <span>{statusLabel}</span>
  </div>
</div>

<style>
  .pixi-wheel-card {
    min-height: 58vh;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;
    border-radius: 34px;
    background:
      radial-gradient(circle at 50% 42%, #fff8ec 0 34%, #f7d37f 35% 48%, transparent 49%),
      linear-gradient(180deg, #fff8ec, #ffe9c6);
    box-shadow: 0 30px 90px #0008;
    overflow: hidden;
  }

  .wheel-pointer {
    width: 0;
    height: 0;
    border-left: 30px solid transparent;
    border-right: 30px solid transparent;
    border-top: 60px solid #2f7d32;
    filter: drop-shadow(0 7px 0 #19481c);
    z-index: 2;
    margin-bottom: -22px;
  }

  .pixi-wheel-host {
    width: min(62vmin, 640px);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
  }

  .pixi-wheel-host :global(canvas) {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .wheel-caption {
    display: grid;
    gap: 3px;
    text-align: center;
    color: #3b1f12;
  }

  .wheel-caption strong {
    font-size: clamp(32px, 4vmin, 56px);
    line-height: .95;
    letter-spacing: -0.04em;
  }

  .wheel-caption span {
    color: #d84624;
    font-weight: 900;
    font-size: clamp(15px, 1.8vmin, 24px);
  }

  @media (max-width: 760px) {
    .pixi-wheel-card { min-height: 62vh; }
    .pixi-wheel-host { width: min(82vmin, 560px); }
  }
</style>
