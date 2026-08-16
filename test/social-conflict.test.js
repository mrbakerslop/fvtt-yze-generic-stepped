import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBarterPrice,
  calculateNegotiatingModifier,
  normalizeSocialConflictConfig,
  usesPlayerChoice,
} from '../src/system/social-conflict.js';

test('negotiating factors and custom modifiers combine', () => {
  assert.equal(calculateNegotiatingModifier(['costsNothing', 'languageTrouble'], 2), 2);
});

test('mutually exclusive factors cannot stack', () => {
  assert.equal(calculateNegotiatingModifier(['activeMorePeople', 'targetMorePeople']), 1);
});

test('barter changes price by the configured amount per net success', () => {
  assert.equal(calculateBarterPrice({ price: 100, netSuccesses: 2, direction: 'buy' }), 80);
  assert.equal(calculateBarterPrice({ price: 100, netSuccesses: 2, direction: 'sell' }), 120);
});

test('ordinary influence against player characters remains player choice by default', () => {
  const config = normalizeSocialConflictConfig();
  assert.equal(usesPlayerChoice({ targetType: 'character', mode: 'persuade', ...config }), true);
  assert.equal(usesPlayerChoice({ targetType: 'character', mode: 'interrogate', ...config }), false);
});
