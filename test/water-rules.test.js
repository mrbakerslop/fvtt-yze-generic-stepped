import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceSinking,
  canWaterMineAffectVessel,
  getCollisionDamage,
  getGroundingDamage,
  getLargeVesselTurnCost,
  getRammingDamage,
  getWaterMishap,
  getWaterTravelProfile,
  getWatercraftComponent,
  isValidGuidedWeaponTarget,
} from '../src/system/water-rules.js';

test('watercraft component tables cover penetrations and surface hits', () => {
  assert.equal(getWatercraftComponent(1, true), 'hull');
  assert.equal(getWatercraftComponent(10, true), 'radio');
  assert.equal(getWatercraftComponent(1, false), 'weapon');
  assert.equal(getWatercraftComponent(10, false), 'ricochet');
});

test('large-vessel turning and collision damage scale with size', () => {
  assert.equal(getLargeVesselTurnCost(1), 0);
  assert.equal(getLargeVesselTurnCost(4), 3);
  assert.equal(getCollisionDamage(3), 3);
  assert.equal(getRammingDamage(3, 2), 5);
});

test('grounding damage counts only sixes', () => {
  assert.equal(getGroundingDamage([1, 6, 5, 6]), 2);
});

test('sinking accumulates banes and compares them with vessel size', () => {
  assert.deepEqual(advanceSinking({ size: 3, progress: 1, breaches: 3, results: [1, 4, 1] }), {
    dice: 3, added: 2, progress: 3, sunk: true,
  });
});

test('water travel applies night speed and terrain modifiers', () => {
  assert.deepEqual(getWaterTravelProfile('river', { night: true }), {
    speed: 0.5, drivingModifier: 2, fishingModifier: 1, encounterMultiplier: 2,
  });
  assert.equal(getWaterTravelProfile('openWater').encounterMultiplier, 4);
});

test('water mine and guided target restrictions use vessel data', () => {
  const vessel = {
    type: 'vehicle',
    system: { domain: 'watercraft', watercraft: { size: 2 }, movement: { type: 'N' } },
  };
  assert.equal(canWaterMineAffectVessel(2, 1), true);
  assert.equal(canWaterMineAffectVessel(1, 1), false);
  assert.equal(isValidGuidedWeaponTarget('watercraft', vessel), true);
  assert.equal(isValidGuidedWeaponTarget('largeVessel', vessel), true);
  assert.equal(isValidGuidedWeaponTarget('aircraft', vessel), false);
});

test('water travel mishaps account for propulsion and terrain', () => {
  assert.equal(getWaterMishap(2, 'motor'), 'engineBlown');
  assert.equal(getWaterMishap(2, 'sail'), 'mastBroken');
  assert.equal(getWaterMishap(6, 'motor', 'river'), 'grounding');
  assert.equal(getWaterMishap(6, 'motor', 'openWater'), 'largeWave');
  assert.equal(getWaterMishap(12), 'majorLeak');
});
