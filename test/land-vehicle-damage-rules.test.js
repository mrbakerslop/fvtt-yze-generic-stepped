import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ammunitionExplosionChance,
  ammunitionRemainingFraction,
  armoredWeaponDamage,
  getLandVehicleComponent,
  increaseBlastRating,
  nextPenetratingComponentRow,
  trackWheelDamage,
} from '../src/system/land-vehicle-damage-rules.js';

test('land vehicles use distinct penetration and surface-hit component tables', () => {
  assert.equal(getLandVehicleComponent(1, true), 'fuel');
  assert.equal(getLandVehicleComponent(10, true), 'radio');
  assert.equal(getLandVehicleComponent(1, false), 'trackWheel');
  assert.equal(getLandVehicleComponent(6, false), 'externalStores');
  assert.equal(getLandVehicleComponent(10, false), 'ricochet');
});

test('secondary penetrating damage moves toward row one', () => {
  assert.equal(nextPenetratingComponentRow(10), 9);
  assert.equal(nextPenetratingComponentRow(1), 0);
});

test('tracks and armored mounted weapons use half-armor protection', () => {
  assert.equal(trackWheelDamage(8, 7, -1), 5);
  assert.equal(trackWheelDamage(3, 7, 0), 0);
  assert.equal(armoredWeaponDamage(8, 9, -1, true), 4);
  assert.equal(armoredWeaponDamage(8, 9, -1, false), 8);
});

test('ammunition loss and explosion risk scale with component damage', () => {
  assert.equal(ammunitionRemainingFraction(1), 0.5);
  assert.equal(ammunitionRemainingFraction(2), 0);
  assert.equal(ammunitionExplosionChance(1), 0.5);
  assert.equal(ammunitionExplosionChance(2), 1);
  assert.equal(increaseBlastRating('C'), 'B');
  assert.equal(increaseBlastRating('A'), 'A');
});
