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
});
