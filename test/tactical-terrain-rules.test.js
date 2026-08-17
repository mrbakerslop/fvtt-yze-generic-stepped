import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTacticalTerrainProfile,
  tacticalMovementAllowance,
  tacticalMovementModifier,
  terrainProvidesCover,
} from '../src/system/tactical-terrain-rules.js';

test('built-in terrain profiles expose movement, ranged, and cover values', () => {
  assert.deepEqual(getTacticalTerrainProfile('debris'), {
    type: 'debris', movement: -2, ranged: -1, coverArmor: 3, infiltration: 1, visibility: null,
  });
  assert.equal(getTacticalTerrainProfile('foliage').ranged, -2);
  assert.equal(terrainProvidesCover(getTacticalTerrainProfile('forest')), true);
  assert.equal(terrainProvidesCover(getTacticalTerrainProfile('field')), false);
});

test('run and crawl allowances use successes according to their movement mode', () => {
  assert.deepEqual(tacticalMovementAllowance('run', 3, {}), { hexes: 5, mode: 'run' });
  assert.deepEqual(tacticalMovementAllowance('crawl', 3, {}), { hexes: 2, mode: 'crawl' });
  assert.deepEqual(tacticalMovementAllowance('run', 2, { forcedCrawl: true }), { hexes: 2, mode: 'crawl' });
  assert.deepEqual(tacticalMovementAllowance('run', 4, { blocking: true }), { hexes: 0, mode: 'blocked' });
});

test('terrain and carried backpack modifiers combine', () => {
  assert.equal(tacticalMovementModifier({ movement: -1 }), -1);
  assert.equal(tacticalMovementModifier({ movement: -1 }, { backpack: true }), -3);
});

test('custom terrain preserves explicit assistance values', () => {
  assert.deepEqual(getTacticalTerrainProfile('custom', {
    name: 'Scree', movement: -2, ranged: -1, coverArmor: 1, infiltration: 2,
    visibility: 4, forcedCrawl: true, blocking: false,
  }), {
    type: 'custom', name: 'Scree', movement: -2, ranged: -1, coverArmor: 1,
    infiltration: 2, visibility: 4, forcedCrawl: true, blocking: false,
  });
});
