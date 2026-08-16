import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMinefieldDetectionModifier,
  getMinefieldDudThreshold,
  getMinefieldExposureCount,
  getMinefieldTriggerDie,
  minefieldAffectsActor,
  resolveMinefieldTriggers,
} from '../src/system/minefield-rules.js';

test('minefield density limits entrants checked in each crossed hex', () => {
  assert.equal(getMinefieldExposureCount({ density: 'false', hexes: 3, entrants: 5 }), 0);
  assert.equal(getMinefieldExposureCount({ density: 'sparse', hexes: 3, entrants: 5 }), 3);
  assert.equal(getMinefieldExposureCount({ density: 'normal', hexes: 3, entrants: 5 }), 6);
  assert.equal(getMinefieldExposureCount({ density: 'dense', hexes: 3, entrants: 5 }), 15);
});

test('probing improves detection and uses a safer trigger die', () => {
  assert.equal(getMinefieldDetectionModifier({ mode: 'probing' }), 2);
  assert.equal(getMinefieldDetectionModifier({ condition: 'overgrown' }), -2);
  assert.equal(getMinefieldDetectionModifier({ mineType: 'antiVehicle', fromVehicle: true }), 0);
  assert.equal(getMinefieldTriggerDie('unaware'), 6);
  assert.equal(getMinefieldTriggerDie('probing'), 10);
});

test('minefield condition determines which triggered mines are duds', () => {
  assert.equal(getMinefieldDudThreshold('fresh'), 0);
  assert.equal(getMinefieldDudThreshold('old'), 1);
  assert.equal(getMinefieldDudThreshold('overgrown'), 2);
  assert.deepEqual(resolveMinefieldTriggers([1, 4, 1, 1], [1, 2, 5], 'overgrown'), {
    attempts: 3,
    duds: 2,
    detonations: 1,
  });
});

test('mine categories affect only compatible Actor types', () => {
  assert.equal(minefieldAffectsActor('antiPersonnel', 'character'), true);
  assert.equal(minefieldAffectsActor('antiPersonnel', 'vehicle'), false);
  assert.equal(minefieldAffectsActor('antiVehicle', 'vehicle'), true);
  assert.equal(minefieldAffectsActor('antiVehicle', 'npc'), false);
  assert.equal(minefieldAffectsActor('mixed', 'vehicle'), true);
  assert.equal(minefieldAffectsActor('mixed', 'character'), true);
});
