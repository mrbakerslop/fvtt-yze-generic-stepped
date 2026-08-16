import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseEngagementTarget,
  getBlastDamageProfile,
  getBlindFireRoll,
  getCityDriveHexes,
  getCityFuelUsed,
  getCityMarchHexes,
  increaseIndoorBlast,
  isAllowedWhileEngaged,
} from '../src/system/urban-operations.js';

test('indoor blast power increases one step and never exceeds A', () => {
  assert.equal(increaseIndoorBlast('D'), 'C');
  assert.equal(increaseIndoorBlast('B'), 'A');
  assert.equal(increaseIndoorBlast('A'), 'A');
  assert.equal(increaseIndoorBlast('–'), '–');
});

test('blast damage profiles use the correct dice, damage, critical, and armor values', () => {
  assert.deepEqual(getBlastDamageProfile('C'), {
    rating: 'C', die: 8, damage: 2, crit: 3, armorModifier: 1,
  });
  assert.equal(getBlastDamageProfile('–'), null);
});

test('blind fire rolls only ammunition dice and cannot directly hit', () => {
  assert.deepEqual(getBlindFireRoll({ rof: 4 }), {
    attribute: 0, skill: 0, rof: 4, locate: false,
    canDirectHit: false, canSuppress: true, automaticHexHit: false,
  });
  assert.equal(getBlindFireRoll({ rof: 2, explosive: true }).automaticHexHit, true);
});

test('city travel applies urban movement and fuel conversion', () => {
  assert.equal(getCityMarchHexes({ road: true }), 2);
  assert.equal(getCityMarchHexes({ road: false }), 1);
  assert.equal(getCityDriveHexes(8), 8);
  assert.equal(getCityDriveHexes(8, { offRoad: true }), 4);
  assert.equal(getCityFuelUsed(8, { roadHexes: 6, offRoadHexes: 1, fuelMultiplier: 2 }), 3);
});

test('engagement restricts slow actions and randomizes third-party fire', () => {
  assert.equal(isAllowedWhileEngaged({ id: 'meleeAttack', speed: 'slow' }), true);
  assert.equal(isAllowedWhileEngaged({ id: 'shootFirearm', speed: 'slow' }), false);
  assert.equal(isAllowedWhileEngaged({ id: 'retreat', speed: 'fast' }), true);
  assert.equal(chooseEngagementTarget('a', 'b', () => 0.1), 'a');
  assert.equal(chooseEngagementTarget('a', 'b', () => 0.9), 'b');
});
