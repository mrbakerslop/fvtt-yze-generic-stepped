import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blastCanPenetrateCover,
  getBlastRadius,
  getEffectiveBlastRating,
  getHeavyWeaponAttribute,
  getHeavyWeaponTargetModifier,
  isArtilleryWeapon,
  isMachineGun,
  resolveDeviation,
  shiftBlastRating,
  usesHeavyWeaponRules,
} from '../src/system/heavy-weapons.js';

function weapon(itemType, props = {}) {
  return { type: 'weapon', system: { itemType, props: { heavyWeapon: true, ...props } } };
}

test('machine guns use their skill without inheriting launcher rules', () => {
  assert.equal(isMachineGun('Light Machine Gun'), true);
  assert.equal(isMachineGun('HMG'), true);
  assert.equal(usesHeavyWeaponRules(weapon('Light Machine Gun')), false);
  assert.equal(usesHeavyWeaponRules(weapon('Rocket Launcher')), true);
});

test('heavy-weapon attributes follow mount and artillery rules', () => {
  assert.equal(getHeavyWeaponAttribute(weapon('Rocket Launcher')), 'str');
  assert.equal(getHeavyWeaponAttribute(weapon('Recoilless Rifle', { tripod: true })), 'agl');
  assert.equal(getHeavyWeaponAttribute(weapon('Mortar')), 'int');
  assert.equal(isArtilleryWeapon(weapon('Field Gun', { artillery: true })), true);
  assert.equal(getHeavyWeaponTargetModifier(weapon('Rocket Launcher'), 'individual'), -2);
  assert.equal(getHeavyWeaponTargetModifier(weapon('Rocket Launcher'), 'hex'), 0);
});

test('deviation uses two dice and cannot exceed half range', () => {
  assert.deepEqual(resolveDeviation(2, 6, 7), {
    direction: 'northEast', directionRoll: 2, rolledDistance: 6, maximumDistance: 4, distance: 4,
  });
  assert.equal(resolveDeviation(6, 3, 20).distance, 3);
});

test('blast propagation handles distance, prone, airburst, direction, and indoor increases', () => {
  assert.equal(shiftBlastRating('C', 1), 'B');
  assert.equal(shiftBlastRating('D', -1), '–');
  assert.equal(getBlastRadius('A'), 3);
  assert.equal(getBlastRadius('B', true), 8);
  assert.equal(getEffectiveBlastRating('A', { distance: 2 }), 'C');
  assert.equal(getEffectiveBlastRating('B', { distance: 2, directional: true }), 'B');
  assert.equal(getEffectiveBlastRating('B', { distance: 3, directional: true }), 'C');
  assert.equal(getEffectiveBlastRating('C', { prone: true }), 'D');
  assert.equal(getEffectiveBlastRating('C', { prone: true, airburst: true }), 'C');
  assert.equal(getEffectiveBlastRating('C', { distance: 1, indoor: true }), 'C');
});

test('solid cover blocks blast suppression when base damage cannot penetrate it', () => {
  assert.equal(blastCanPenetrateCover(2, 2, 1), true);
  assert.equal(blastCanPenetrateCover(2, 4, 1), false);
});
