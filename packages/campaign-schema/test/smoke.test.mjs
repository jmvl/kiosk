import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import packageJson from '../package.json' with { type: 'json' };

describe('@retail-kiosk/campaign-schema skeleton', () => {
  it('declares the baseline scripts', () => {
    assert.equal(packageJson.name, '@retail-kiosk/campaign-schema');
    assert.equal(packageJson.scripts.build, 'tsc -p tsconfig.build.json');
    assert.equal(packageJson.scripts.typecheck, 'tsc -p tsconfig.json --noEmit');
    assert.equal(packageJson.scripts.test, 'node --test test/smoke.test.mjs');
  });
});
