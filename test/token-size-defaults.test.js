import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeTokenDimension,
  normalizeTokenSizeDefaults,
  TOKEN_SIZE_ACTOR_TYPES,
} from '../src/system/token-size-defaults.js';

test('token dimensions accept useful fractional and large grid sizes', () => {
  assert.equal(normalizeTokenDimension(0.25), 0.25);
  assert.equal(normalizeTokenDimension('2.5'), 2.5);
  assert.equal(normalizeTokenDimension(10), 10);
});

test('invalid token dimensions fall back safely', () => {
  assert.equal(normalizeTokenDimension(0, 1), 1);
  assert.equal(normalizeTokenDimension(11, 2), 2);
  assert.equal(normalizeTokenDimension('invalid', 3), 3);
});

test('legacy character size supplies Character and NPC defaults only', () => {
  const configured = normalizeTokenSizeDefaults({}, 0.75);
  assert.deepEqual(configured.character, { width: 0.75, height: 0.75 });
  assert.deepEqual(configured.npc, { width: 0.75, height: 0.75 });
  const otherTypes = TOKEN_SIZE_ACTOR_TYPES.filter(type => !['character', 'npc'].includes(type));
  for (const actorType of otherTypes) {
    assert.deepEqual(configured[actorType], { width: 1, height: 1 });
  }
});

test('per-type rectangular dimensions override defaults', () => {
  const configured = normalizeTokenSizeDefaults({
    vehicle: { width: 2, height: 1 },
    container: { width: 1.5, height: 0.5 },
  });
  assert.deepEqual(configured.vehicle, { width: 2, height: 1 });
  assert.deepEqual(configured.container, { width: 1.5, height: 0.5 });
});
