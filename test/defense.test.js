import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coverAppliesAgainst,
  coverProtectsLocation,
  getEffectiveAttackSuccesses,
  isBlockableAction,
  resolveBlock,
} from '../src/system/defense.js';

test('each Block success cancels one attack success and excess successes are ignored', () => {
  assert.deepEqual(resolveBlock({ attackSuccesses: 2, blockSuccesses: 4 }), {
    attackSuccesses: 2,
    blockSuccesses: 4,
    cancelledSuccesses: 2,
    remainingSuccesses: 0,
    blocked: true,
  });
  assert.equal(resolveBlock({ attackSuccesses: 3, blockSuccesses: 1 }).remainingSuccesses, 2);
});

test('only rules-defined initial close-combat attacks can be blocked', () => {
  for (const action of ['unarmedAttack', 'meleeAttack', 'shove', 'disarm', 'grapple', 'divingBlow']) {
    assert.equal(isBlockableAction(action), true);
  }
  for (const action of ['shootFirearm', 'grappleAttack', 'retreatFreeAttack']) {
    assert.equal(isBlockableAction(action), false);
  }
});

test('a resolved Block replaces the raw success count for outcomes', () => {
  assert.equal(getEffectiveAttackSuccesses({
    baseSuccessQty: 3,
    options: { defense: { status: 'resolved', remainingSuccesses: 1 } },
  }), 1);
  assert.equal(getEffectiveAttackSuccesses({ baseSuccessQty: 3, options: {} }), 3);
});

test('partial cover protects only torso and legs while full cover protects all locations', () => {
  assert.equal(coverProtectsLocation('partialCover', 'torso'), true);
  assert.equal(coverProtectsLocation('partialCover', 'legs'), true);
  assert.equal(coverProtectsLocation('partialCover', 'head'), false);
  assert.equal(coverProtectsLocation('fullCover', 'head'), true);
});

test('directional cover applies only to its recorded threat direction', () => {
  const cover = { type: 'partialCover', armor: 3, againstUuid: 'Actor.attacker' };
  assert.equal(coverAppliesAgainst(cover, 'Actor.attacker'), true);
  assert.equal(coverAppliesAgainst(cover, 'Actor.other'), false);
  assert.equal(coverAppliesAgainst({ ...cover, againstUuid: '*' }, 'Actor.other'), true);
});
