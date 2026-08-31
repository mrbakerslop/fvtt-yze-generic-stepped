import assert from 'node:assert/strict';
import test from 'node:test';

import { getBuildOptions } from '../esbuild.config.js';

test('production builds preserve warning and error diagnostics', () => {
  const options = getBuildOptions({ production: true });

  assert.deepEqual(options.drop, ['debugger']);
  assert.deepEqual(options.pure, ['console.log', 'console.debug']);
  assert.equal(options.sourcemap, false);
});

test('development builds retain all console diagnostics', () => {
  const options = getBuildOptions();

  assert.deepEqual(options.drop, []);
  assert.deepEqual(options.pure, []);
  assert.equal(options.sourcemap, 'inline');
});
