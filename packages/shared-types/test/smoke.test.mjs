import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import packageJson from '../package.json' with { type: 'json' };

describe('@retail-kiosk/shared-types package', () => {
  it('declares the baseline build/typecheck scripts and runnable tests', () => {
    assert.equal(packageJson.name, '@retail-kiosk/shared-types');
    assert.equal(packageJson.scripts.build, 'tsc -p tsconfig.build.json');
    assert.equal(packageJson.scripts.typecheck, 'tsc -p tsconfig.json --noEmit');
    assert.match(packageJson.scripts.test, /node --test/);
  });
});
