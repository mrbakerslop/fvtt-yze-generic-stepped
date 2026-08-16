import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveOpposedRoll } from '../src/system/opposed-rolls.js';

test('active side must score strictly more successes', () => {
  assert.deepEqual(resolveOpposedRoll({ activeSuccesses: 3, passiveSuccesses: 1 }), {
    activeSuccesses: 3, passiveSuccesses: 1, cancelledSuccesses: 1, netSuccesses: 2, won: true, tied: false,
  });
  assert.equal(resolveOpposedRoll({ activeSuccesses: 2, passiveSuccesses: 2 }).won, false);
  assert.equal(resolveOpposedRoll({ activeSuccesses: 1, passiveSuccesses: 2 }).netSuccesses, 0);
});
