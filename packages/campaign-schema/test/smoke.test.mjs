import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import packageJson from '../package.json' with { type: 'json' };

describe('@retail-kiosk/campaign-schema package', () => {
  it('declares build/typecheck/test scripts plus manifest validation', () => {
    assert.equal(packageJson.name, '@retail-kiosk/campaign-schema');
    assert.equal(packageJson.scripts.build, 'tsc -p tsconfig.build.json');
    assert.equal(packageJson.scripts.typecheck, 'tsc -p tsconfig.json --noEmit');
    assert.match(packageJson.scripts.test, /node --test/);
    assert.match(packageJson.scripts['package:validate'], /validate-manifest/);
  });
});
