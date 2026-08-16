import assert from 'node:assert/strict';
import test from 'node:test';

import {
  causesWeaponJam,
  getClearJamModifier,
  resolveClearJamAction,
} from '../src/system/weapon-jams.js';

test('only a pushed Weapon roll with at least two banes causes a jam', () => {
  const weapon = { type: 'weapon' };
  assert.equal(causesWeaponJam({ pushed: true, jamCount: 2 }, weapon), true);
  assert.equal(causesWeaponJam({ pushed: true, jamCount: 1 }, weapon), false);
  assert.equal(causesWeaponJam({ pushed: false, jamCount: 3 }, weapon), false);
  assert.equal(causesWeaponJam({ pushed: true, jamCount: 3 }, { type: 'gear' }), false);
  assert.equal(causesWeaponJam({
    pushed: true,
    jamCount: 3,
    options: { defenseFor: { attackMessageId: 'message' } },
  }, weapon), false);
});

test('clearing a jam spends a slow action only in active combat', () => {
  assert.deepEqual(resolveClearJamAction({ inCombat: false, slow: 0 }), {
    available: true,
    spentFrom: null,
  });
  assert.deepEqual(resolveClearJamAction({ inCombat: true, slow: 1 }), {
    available: true,
    spentFrom: 'slow',
  });
  assert.deepEqual(resolveClearJamAction({ inCombat: true, slow: 0 }), {
    available: false,
    spentFrom: null,
  });
});

test('clear jam applies configured action modifiers', () => {
  const actor = {
    getRollModifiers: () => [
      { category: 'action', target: 'clearJam', value: 1 },
      { category: 'action', target: 'reload', value: 2 },
      { category: 'skill', target: 'rangedCombat', value: -1 },
    ],
  };
  assert.equal(getClearJamModifier(actor), 1);
  assert.equal(getClearJamModifier(null), 0);
});
