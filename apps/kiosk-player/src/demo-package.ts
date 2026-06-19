export type CampaignLocale = 'fr-BE' | 'nl-BE';

export interface LocalizedCopy {
  'fr-BE': string;
  'nl-BE': string;
}

export interface CampaignQuizChoice {
  choice_id: string;
  label: LocalizedCopy;
  correct: boolean;
}

export interface CampaignOutcome {
  outcome_id: string;
  outcome_type: 'win' | 'loss' | 'consolation' | 'grand_prize' | 'custom';
  active: boolean;
  localized_label: LocalizedCopy;
  weight: number;
  print_ticket: boolean;
  ticket_template_id?: string;
  bitmap_asset_id?: string;
  qr_payload_template?: string;
  cashier_instruction: LocalizedCopy;
  terms: LocalizedCopy;
}

export interface VisualWheelSegment {
  segment_id: string;
  outcome_id: string;
  bitmap_asset_id?: string;
  localized_label?: LocalizedCopy;
}

export const drOetkerManifest = {
  package_id: 'dr-oetker-pizza-wheel',
  version: '1.0.0',
  display_name: 'Dr. Oetker Pizza Wheel',
  bridge_capabilities: ['recordTelemetry', 'complete', 'fail', 'getScheduleContext', 'getRuntimeCapabilities'],
  quiz: {
    question: {
      'fr-BE': 'Quel produit correspond à une pizza Dr. Oetker ?',
      'nl-BE': 'Welk product hoort bij een Dr. Oetker pizza?',
    },
    choices: [
      { choice_id: 'ristorante-pizza', label: { 'fr-BE': 'Une pizza Ristorante', 'nl-BE': 'Een Ristorante pizza' }, correct: true },
      { choice_id: 'soft-drink', label: { 'fr-BE': 'Une boisson pétillante', 'nl-BE': 'Een frisdrank' }, correct: false },
      { choice_id: 'laundry-tabs', label: { 'fr-BE': 'Des capsules de lessive', 'nl-BE': 'Wascapsules' }, correct: false },
    ] satisfies CampaignQuizChoice[],
    attempt_limit: 2,
    retry_copy: {
      'fr-BE': 'Presque ! Essayez encore.',
      'nl-BE': 'Bijna! Probeer opnieuw.',
    },
    failed_copy: {
      'fr-BE': 'Dommage, ce n’est pas la bonne réponse. Merci de votre participation.',
      'nl-BE': 'Jammer, dat is niet het juiste antwoord. Bedankt voor uw deelname.',
    },
  },
  outcome_strategy: {
    authority: 'local_backend',
    offline_required: true,
    selection: 'weighted_random',
    outcomes: [
      {
        outcome_id: 'small-discount',
        outcome_type: 'win',
        active: true,
        localized_label: { 'fr-BE': 'Petite réduction pizza', 'nl-BE': 'Kleine pizzakorting' },
        weight: 45,
        print_ticket: true,
        ticket_template_id: 'discount-ticket',
        bitmap_asset_id: 'discount-ticket-placeholder',
        cashier_instruction: { 'fr-BE': 'Présentez ce ticket à la caisse.', 'nl-BE': 'Toon dit ticket aan de kassa.' },
        terms: { 'fr-BE': 'Valable aujourd’hui dans le magasin participant.', 'nl-BE': 'Vandaag geldig in de deelnemende winkel.' },
      },
      {
        outcome_id: 'standard-discount',
        outcome_type: 'win',
        active: true,
        localized_label: { 'fr-BE': 'Réduction pizza standard', 'nl-BE': 'Standaard pizzakorting' },
        weight: 30,
        print_ticket: true,
        ticket_template_id: 'discount-ticket',
        bitmap_asset_id: 'discount-ticket-placeholder',
        cashier_instruction: { 'fr-BE': 'Présentez ce ticket à la caisse.', 'nl-BE': 'Toon dit ticket aan de kassa.' },
        terms: { 'fr-BE': 'Valable aujourd’hui dans le magasin participant.', 'nl-BE': 'Vandaag geldig in de deelnemende winkel.' },
      },
      {
        outcome_id: 'consolation-qr',
        outcome_type: 'consolation',
        active: true,
        localized_label: { 'fr-BE': 'Merci — scannez votre souvenir', 'nl-BE': 'Bedankt — scan uw aandenken' },
        weight: 20,
        print_ticket: true,
        ticket_template_id: 'consolation-qr-ticket',
        bitmap_asset_id: 'consolation-ticket-placeholder',
        cashier_instruction: { 'fr-BE': 'Scannez le QR ou encodez le code lisible sur le ticket.', 'nl-BE': 'Scan de QR of voer de leesbare code op het ticket in.' },
        terms: { 'fr-BE': 'Souvenir promotionnel sans valeur monétaire.', 'nl-BE': 'Promotioneel aandenken zonder geldwaarde.' },
      },
      {
        outcome_id: 'soft-thanks-no-print',
        outcome_type: 'loss',
        active: true,
        localized_label: { 'fr-BE': 'Merci de votre participation', 'nl-BE': 'Bedankt voor uw deelname' },
        weight: 5,
        print_ticket: false,
        cashier_instruction: { 'fr-BE': 'Aucune action caisse.', 'nl-BE': 'Geen kassahandeling.' },
        terms: { 'fr-BE': 'Aucun ticket imprimé pour ce résultat.', 'nl-BE': 'Geen ticket afgedrukt voor dit resultaat.' },
      },
    ] satisfies CampaignOutcome[],
  },
  visual_wheel: {
    segments: [
      { segment_id: 'slice-small-one', outcome_id: 'small-discount', localized_label: { 'fr-BE': '-0,50 € Ristorante', 'nl-BE': '-0,50 € Ristorante' } },
      { segment_id: 'slice-standard-one', outcome_id: 'standard-discount', localized_label: { 'fr-BE': '-1 € Casa di Mama', 'nl-BE': '-1 € Casa di Mama' } },
      { segment_id: 'slice-consolation-one', outcome_id: 'consolation-qr', localized_label: { 'fr-BE': 'QR Pizza', 'nl-BE': 'QR Pizza' } },
      { segment_id: 'slice-small-two', outcome_id: 'small-discount', localized_label: { 'fr-BE': '-0,50 € Tradizionale', 'nl-BE': '-0,50 € Tradizionale' } },
      { segment_id: 'slice-soft-thanks', outcome_id: 'soft-thanks-no-print', localized_label: { 'fr-BE': 'Merci', 'nl-BE': 'Bedankt' } },
      { segment_id: 'slice-standard-two', outcome_id: 'standard-discount', localized_label: { 'fr-BE': '-1 € Dr. Oetker', 'nl-BE': '-1 € Dr. Oetker' } },
    ] satisfies VisualWheelSegment[],
  },
} as const;

export function localized(copy: LocalizedCopy | undefined, locale: CampaignLocale): string {
  return copy?.[locale] ?? copy?.['fr-BE'] ?? copy?.['nl-BE'] ?? '';
}

export function segmentIndexForOutcome(outcomeId: string, spinCount = 0): number {
  const matches = drOetkerManifest.visual_wheel.segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment.outcome_id === outcomeId);
  const fallback = matches[0];
  if (!fallback) return 0;
  return matches[spinCount % matches.length]?.index ?? fallback.index;
}

export const drOetkerModuleHtml = `<!doctype html>
<html lang="fr-BE">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Dr. Oetker Pizza Wheel Presentation Module</title>
<style>
  :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; background:#fff8ec; color:#3b1f12; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; overflow:hidden; }
  main { width:min(94vw, 760px); display:grid; place-items:center; gap:18px; text-align:center; padding:32px; }
  .pointer { width:0; height:0; border-left:22px solid transparent; border-right:22px solid transparent; border-top:44px solid #2f7d32; filter:drop-shadow(0 6px 0 #19481c); z-index:2; }
  .wheel { --rotation: 0deg; width:clamp(250px, 52vmin, 520px); height:clamp(250px, 52vmin, 520px); border-radius:50%; border:18px solid #d84624; background:conic-gradient(#f7d37f 0 60deg,#fff1d5 60deg 120deg,#d84624 120deg 180deg,#f7d37f 180deg 240deg,#2f7d32 240deg 300deg,#fff1d5 300deg 360deg); box-shadow:inset 0 0 0 22px #fff8ec, inset 0 0 0 34px #f5ba62, 0 24px 54px #6b2a132b; transform:rotate(var(--rotation)); transition:transform 3.8s cubic-bezier(.12,.7,.14,1); position:relative; }
  .segment-label { position:absolute; width:30%; padding:4px 6px; border-radius:999px; background:#fff8ece6; transform:translate(-50%, -50%); z-index:3; color:#3b1f12; font-weight:900; font-size:clamp(9px, 1.45vmin, 14px); line-height:1; text-align:center; text-transform:uppercase; text-wrap:balance; box-shadow:0 2px 10px #3b1f1228; pointer-events:none; }
  .wheel::before { content:''; position:absolute; inset:25%; border-radius:50%; background:radial-gradient(circle, #f7d37f 0 42%, #d84624 43% 48%, #fff8ec 49%); box-shadow:0 0 0 10px #3b1f1214; }
  .wheel::after { content:''; position:absolute; inset:9%; border-radius:50%; background:radial-gradient(circle at 32% 28%, #9b2d18 0 3%, transparent 4%), radial-gradient(circle at 66% 35%, #2f7d32 0 3%, transparent 4%), radial-gradient(circle at 42% 70%, #9b2d18 0 3%, transparent 4%); opacity:.8; }
  h1 { font-size:clamp(34px, 7vw, 78px); line-height:.92; letter-spacing:-.06em; margin:0; }
  p { max-width:24ch; margin:0; font-size:clamp(18px, 3vw, 30px); }
  .status { font-weight:900; color:#d84624; }
</style>
</head>
<body>
<main>
  <div class="pointer" aria-hidden="true"></div>
  <div id="wheel" class="wheel" aria-label="Pizza prize wheel">
    ${drOetkerManifest.visual_wheel.segments.map((segment, index) => {
      const radians = (((index * 60) + 30) - 90) * Math.PI / 180;
      const left = 50 + (34 * Math.cos(radians));
      const top = 50 + (34 * Math.sin(radians));
      return `<span class="segment-label" style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%">${localized(segment.localized_label, 'fr-BE')}</span>`;
    }).join('')}
  </div>
  <h1>Pizza Wheel</h1>
  <p id="status" class="status">Concours · Wedstrijd</p>
</main>
<script>
(() => {
  const protocol = 'retail-kiosk-package-bridge/v1';
  const wheel = document.getElementById('wheel');
  const status = document.getElementById('status');
  const segments = 6;
  let wheelRotation = 0;
  let spinAnimation = null;
  parent.postMessage({ protocol, type: 'request', id: 'dr-oetker-loaded', method: 'recordTelemetry', payload: { event: 'package_loaded', package_id: 'dr-oetker-pizza-wheel' } }, '*');
  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.protocol !== protocol || message.type !== 'presentation') return;
    if (message.action === 'idle') {
      status.textContent = message.label || 'Concours · Wedstrijd';
      spinAnimation?.cancel?.();
      spinAnimation = null;
      wheelRotation = 0;
      wheel.style.setProperty('--rotation', '0deg');
      return;
    }
    if (message.action === 'spin') {
      const index = Number.isInteger(message.segmentIndex) ? message.segmentIndex : 0;
      const stop = 360 - ((index + 0.5) * (360 / segments));
      const current = ((wheelRotation % 360) + 360) % 360;
      const deltaToStop = (stop - current + 360) % 360;
      const target = wheelRotation + 1440 + deltaToStop;
      spinAnimation?.cancel?.();
      wheel.style.setProperty('--rotation', target + 'deg');
      if (typeof wheel.animate === 'function') {
        const animation = wheel.animate([
          { transform: 'rotate(' + wheelRotation + 'deg)' },
          { transform: 'rotate(' + target + 'deg)' }
        ], { duration: 3800, easing: 'cubic-bezier(.12,.7,.14,1)', fill: 'forwards' });
        spinAnimation = animation;
        animation.addEventListener('finish', () => {
          if (spinAnimation === animation) {
            wheel.style.setProperty('--rotation', target + 'deg');
            animation.cancel();
            spinAnimation = null;
          }
        });
      }
      wheelRotation = target;
      status.textContent = message.label || 'Résultat confirmé';
    }
  });
})();
</script>
</body>
</html>`;

export const chocomelManifest = drOetkerManifest;
export const demoPackageHtml = drOetkerModuleHtml;
