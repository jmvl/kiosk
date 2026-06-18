import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  packageManifestSchemaVersion,
  validatePackageManifest,
} from '../dist/index.js';

const validManifest = {
  schema_version: packageManifestSchemaVersion,
  package_id: 'chocomel-wheel',
  version: '1.0.0',
  display_name: 'Chocomel Prize Wheel',
  campaign_short_code: 'CHO',
  runtime_contract_version: '1',
  min_runtime_version: '0.1.0',
  min_player_version: '0.1.0',
  orientation: 'landscape',
  resolution: { width: 1920, height: 1080 },
  bridge_capabilities: ['recordTelemetry', 'requestPrint', 'complete', 'fail'],
  entrypoint: 'module/index.html',
  files: [
    {
      path: 'module/index.html',
      size_bytes: 12,
      sha256: 'a'.repeat(64),
      media_type: 'text/html',
      role: 'entrypoint',
    },
    {
      path: 'ticket-template/template.txt',
      size_bytes: 10,
      sha256: 'b'.repeat(64),
      media_type: 'text/plain',
      role: 'ticket_template',
    },
  ],
  ticket_template: { path: 'ticket-template/template.txt', qr_enabled: true },
};

describe('@retail-kiosk/campaign-schema validator', () => {
  it('accepts a valid package manifest', () => {
    const result = validatePackageManifest(validManifest);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.manifest.package_id, 'chocomel-wheel');
  });

  it('rejects missing, unsafe, and malformed manifest fields', () => {
    const result = validatePackageManifest({
      ...validManifest,
      package_id: 'Bad Package',
      version: 'one',
      entrypoint: '../escape.html',
      files: [
        {
          path: '../escape.html',
          size_bytes: -1,
          sha256: 'not-a-digest',
          role: 'unknown',
        },
      ],
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'package_id'));
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'entrypoint'));
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'files[0].sha256'));
  });

  it('rejects an entrypoint listed with the wrong role', () => {
    const result = validatePackageManifest({
      ...validManifest,
      files: validManifest.files.map((file) =>
        file.path === validManifest.entrypoint ? { ...file, role: 'asset' } : file,
      ),
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'entrypoint'));
  });

  it('rejects a ticket template path that is not listed as a ticket_template file', () => {
    const result = validatePackageManifest({
      ...validManifest,
      ticket_template: { path: 'ticket-template/missing.txt', qr_enabled: true },
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'ticket_template.path'));
  });

  it('rejects a ticket template path listed with the wrong role', () => {
    const result = validatePackageManifest({
      ...validManifest,
      files: [
        validManifest.files[0],
        {
          ...validManifest.files[1],
          role: 'asset',
        },
      ],
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'ticket_template.path'));
  });

  it('rejects packages whose files exceed package_size_limit_bytes', () => {
    const result = validatePackageManifest({
      ...validManifest,
      package_size_limit_bytes: 1,
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'package_size_limit_bytes'));
  });

  it('accepts an offline backend-authoritative prize table for hybrid wheel campaigns', () => {
    const result = validatePackageManifest({
      ...validManifest,
      outcome_strategy: {
        authority: 'local_backend',
        offline_required: true,
        selection: 'weighted_random',
        prizes: [
          { prize_id: 'free-chocomel', label: 'Free Chocomel', weight: 10, max_wins_per_package: 100 },
          { prize_id: 'try-again', label: 'Try again', weight: 90 },
        ],
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.manifest.outcome_strategy?.authority, 'local_backend');
    assert.equal(result.ok && result.manifest.outcome_strategy?.offline_required, true);
    assert.equal(result.ok && result.manifest.outcome_strategy?.prizes[0].weight, 10);
  });

  it('rejects frontend-owned or empty prize strategies for offline hybrid campaigns', () => {
    const frontendResult = validatePackageManifest({
      ...validManifest,
      outcome_strategy: {
        authority: 'campaign_module',
        offline_required: true,
        selection: 'weighted_random',
        prizes: [{ prize_id: 'free-chocomel', label: 'Free Chocomel', weight: 10 }],
      },
    });
    assert.equal(frontendResult.ok, false);
    assert.ok(!frontendResult.ok && frontendResult.errors.some((error) => error.path === 'outcome_strategy.authority'));

    const emptyResult = validatePackageManifest({
      ...validManifest,
      outcome_strategy: {
        authority: 'local_backend',
        offline_required: true,
        selection: 'weighted_random',
        prizes: [],
      },
    });
    assert.equal(emptyResult.ok, false);
    assert.ok(!emptyResult.ok && emptyResult.errors.some((error) => error.path === 'outcome_strategy.prizes'));
  });

  it('requires legal paths to be safe and listed as legal files', () => {
    const validLegalManifest = {
      ...validManifest,
      legal: {
        terms_path: 'legal/terms.txt',
        privacy_path: 'legal/privacy.txt',
      },
      files: [
        ...validManifest.files,
        {
          path: 'legal/terms.txt',
          size_bytes: 5,
          sha256: 'c'.repeat(64),
          role: 'legal',
        },
        {
          path: 'legal/privacy.txt',
          size_bytes: 6,
          sha256: 'd'.repeat(64),
          role: 'legal',
        },
      ],
    };

    assert.equal(validatePackageManifest(validLegalManifest).ok, true);

    const unsafeResult = validatePackageManifest({
      ...validLegalManifest,
      legal: { terms_path: '../terms.txt' },
    });
    assert.equal(unsafeResult.ok, false);
    assert.ok(!unsafeResult.ok && unsafeResult.errors.some((error) => error.path === 'legal.terms_path'));

    const unlistedResult = validatePackageManifest({
      ...validLegalManifest,
      legal: { privacy_path: 'legal/unlisted.txt' },
    });
    assert.equal(unlistedResult.ok, false);
    assert.ok(!unlistedResult.ok && unlistedResult.errors.some((error) => error.path === 'legal.privacy_path'));
  });

  it('accepts bilingual quiz, generic outcomes, ticket templates, bitmap assets, and visual wheel mapping', () => {
    const localized = (fr, nl) => ({ 'fr-BE': fr, 'nl-BE': nl });
    const result = validatePackageManifest({
      ...validManifest,
      files: [
        ...validManifest.files,
        {
          path: 'assets/tickets/discount.bmp',
          size_bytes: 20,
          sha256: 'e'.repeat(64),
          media_type: 'image/bmp',
          role: 'asset',
        },
      ],
      quiz: {
        question: localized('Quelle pizza est Dr. Oetker ?', 'Welke pizza is Dr. Oetker?'),
        choices: [
          { choice_id: 'ristorante', label: localized('Ristorante', 'Ristorante'), correct: true },
          { choice_id: 'cola', label: localized('Cola', 'Cola'), correct: false },
          { choice_id: 'chips', label: localized('Chips', 'Chips'), correct: false },
        ],
        retry_copy: localized('Presque ! Essayez encore.', 'Bijna! Probeer opnieuw.'),
        failed_copy: localized('Merci de votre participation.', 'Bedankt voor uw deelname.'),
      },
      bitmap_assets: [{ asset_id: 'discount-ticket', path: 'assets/tickets/discount.bmp' }],
      ticket_templates: [{ template_id: 'discount-ticket', path: 'ticket-template/template.txt', bitmap_asset_id: 'discount-ticket' }],
      outcome_strategy: {
        authority: 'local_backend',
        offline_required: true,
        selection: 'weighted_random',
        outcomes: [
          {
            outcome_id: 'discount-small',
            outcome_type: 'win',
            active: true,
            localized_label: localized('Réduction pizza', 'Pizza korting'),
            weight: 80,
            print_ticket: true,
            ticket_template_id: 'discount-ticket',
            bitmap_asset_id: 'discount-ticket',
            qr_payload_template: 'https://promo.acmea.tech/r/{{ticket_code}}',
            cashier_instruction: localized('Présentez ce ticket à la caisse.', 'Toon dit ticket aan de kassa.'),
            terms: localized('Valable aujourd’hui.', 'Vandaag geldig.'),
          },
          {
            outcome_id: 'friendly-thanks',
            outcome_type: 'consolation',
            active: true,
            localized_label: localized('Merci', 'Bedankt'),
            weight: 20,
            print_ticket: false,
            cashier_instruction: localized('Aucune action caisse.', 'Geen kassahandeling.'),
            terms: localized('Sans ticket.', 'Geen ticket.'),
          },
        ],
      },
      visual_wheel: {
        segments: [
          { segment_id: 'slice-one', outcome_id: 'discount-small', bitmap_asset_id: 'discount-ticket' },
          { segment_id: 'slice-two', outcome_id: 'discount-small' },
          { segment_id: 'slice-three', outcome_id: 'friendly-thanks' },
        ],
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.manifest.quiz?.attempt_limit, 2);
    assert.equal(result.ok && result.manifest.outcome_strategy?.outcomes?.[0]?.print_ticket, true);
    assert.equal(result.ok && result.manifest.visual_wheel?.segments.length, 3);
  });

  it('rejects missing bilingual quiz copy, wrong quiz shape, and wrong correct answer count', () => {
    const localized = (fr, nl) => ({ 'fr-BE': fr, 'nl-BE': nl });
    const result = validatePackageManifest({
      ...validManifest,
      quiz: {
        question: { 'fr-BE': 'Question seule' },
        choices: [
          { choice_id: 'one', label: localized('Un', 'Een'), correct: true },
          { choice_id: 'two', label: localized('Deux', 'Twee'), correct: true },
        ],
      },
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'quiz.question.nl-BE'));
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'quiz.choices' && error.message.includes('exactly 3')));
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'quiz.choices' && error.message.includes('exactly 1')));
  });

  it('rejects invalid generic outcome ticket, QR, bitmap, and visual mapping references', () => {
    const localized = (fr, nl) => ({ 'fr-BE': fr, 'nl-BE': nl });
    const result = validatePackageManifest({
      ...validManifest,
      ticket_templates: [{ template_id: 'known-template', path: 'ticket-template/template.txt' }],
      outcome_strategy: {
        authority: 'local_backend',
        offline_required: true,
        selection: 'weighted_random',
        outcomes: [
          {
            outcome_id: 'discount-small',
            outcome_type: 'win',
            active: true,
            localized_label: localized('Réduction pizza', 'Pizza korting'),
            weight: 80,
            print_ticket: true,
            ticket_template_id: 'missing-template',
            bitmap_asset_id: 'missing-bitmap',
            qr_payload_template: 'https://promo.acmea.tech/static-code',
            cashier_instruction: localized('Présentez ce ticket à la caisse.', 'Toon dit ticket aan de kassa.'),
            terms: localized('Valable aujourd’hui.', 'Vandaag geldig.'),
          },
        ],
      },
      visual_wheel: { segments: [{ segment_id: 'slice-one', outcome_id: 'missing-outcome' }] },
    });

    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'outcome_strategy.outcomes[0].ticket_template_id'));
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'outcome_strategy.outcomes[0].bitmap_asset_id'));
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'outcome_strategy.outcomes[0].qr_payload_template'));
    assert.ok(!result.ok && result.errors.some((error) => error.path === 'visual_wheel.segments[0].outcome_id'));
  });

  it('accepts an explicitly approved QR payload equivalent without {{ticket_code}}', () => {
    const localized = (fr, nl) => ({ 'fr-BE': fr, 'nl-BE': nl });
    const result = validatePackageManifest({
      ...validManifest,
      ticket_templates: [{ template_id: 'discount-ticket', path: 'ticket-template/template.txt' }],
      outcome_strategy: {
        authority: 'local_backend',
        offline_required: true,
        selection: 'weighted_random',
        outcomes: [
          {
            outcome_id: 'discount-small',
            outcome_type: 'win',
            active: true,
            localized_label: localized('Réduction pizza', 'Pizza korting'),
            weight: 80,
            print_ticket: true,
            ticket_template_id: 'discount-ticket',
            qr_payload_template: 'signed-ticket-code-placeholder',
            approved_qr_payload_equivalent: 'Retailer POS encodes backend signed ticket code outside the URL template.',
            cashier_instruction: localized('Présentez ce ticket à la caisse.', 'Toon dit ticket aan de kassa.'),
            terms: localized('Valable aujourd’hui.', 'Vandaag geldig.'),
          },
        ],
      },
    });

    assert.equal(result.ok, true);
  });
});
