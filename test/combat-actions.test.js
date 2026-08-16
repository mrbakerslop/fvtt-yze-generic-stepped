import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCombatActionResetUpdate,
  resolveCombatActionSpend,
  startsCombatRound,
} from '../src/system/combat-actions.js';

test('a tracked Fast action spends Fast before Slow', () => {
  assert.deepEqual(resolveCombatActionSpend({
    inCombat: true, speed: 'fast', fast: 1, slow: 1,
  }), {
    tracked: true,
    available: true,
    spentFrom: 'fast',
    remaining: { fast: 0, slow: 1 },
  });
});

test('a Slow action can be converted into a second Fast action', () => {
  assert.deepEqual(resolveCombatActionSpend({
    inCombat: true, speed: 'fast', fast: 0, slow: 1,
  }), {
    tracked: true,
    available: true,
    spentFrom: 'slow',
    remaining: { fast: 0, slow: 0 },
  });
});

test('a Slow action cannot be paid from the Fast action pool', () => {
  assert.deepEqual(resolveCombatActionSpend({
    inCombat: true, speed: 'slow', fast: 1, slow: 0,
  }), {
    tracked: true,
    available: false,
    spentFrom: null,
    remaining: { fast: 1, slow: 0 },
  });
});

test('combat actions are not tracked outside active combat', () => {
  assert.deepEqual(resolveCombatActionSpend({
    inCombat: false, speed: 'slow', fast: 0, slow: 0,
  }), {
    tracked: false,
    available: true,
    spentFrom: null,
    remaining: { fast: 0, slow: 0 },
  });
});

test('only entering a positive combat round triggers an action reset', () => {
  assert.equal(startsCombatRound({ round: 2, turn: 0 }), true);
  assert.equal(startsCombatRound({ round: 0, turn: 0 }), false);
  assert.equal(startsCombatRound({ turn: 1 }), false);
});

test('action reset restores each pool to its configured maximum', () => {
  assert.deepEqual(getCombatActionResetUpdate({
    system: {
      actions: {
        fast: { value: 0, max: 2 },
        slow: { value: 0, max: 1 },
      },
    },
  }), {
    'system.actions.fast.value': 2,
    'system.actions.slow.value': 1,
  });
  assert.equal(getCombatActionResetUpdate({ system: {} }), null);
});
