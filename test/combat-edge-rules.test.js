import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCloseCombatEdges,
  getMachineGunSupportRule,
  getOneHandedRule,
  getRangeBand,
  getRangedCombatEdges,
  getShotgunDamageReduction,
  RANGE_BANDS,
} from '../src/system/combat-edge-rules.js';

test('range bands extend to eight times the short range', () => {
  assert.equal(getRangeBand(0, 5, true), RANGE_BANDS.SAME_HEX);
  assert.equal(getRangeBand(5, 5), RANGE_BANDS.SHORT);
  assert.equal(getRangeBand(10, 5), RANGE_BANDS.MEDIUM);
  assert.equal(getRangeBand(20, 5), RANGE_BANDS.LONG);
  assert.equal(getRangeBand(40, 5), RANGE_BANDS.EXTREME);
  assert.equal(getRangeBand(41, 5), RANGE_BANDS.OUT_OF_RANGE);
});

test('shotguns lose damage instead of suffering range modifiers', () => {
  const result = getRangedCombatEdges({ band: RANGE_BANDS.LONG, shotgun: true });
  assert.deepEqual(result.modifiers, []);
  assert.equal(result.damageReduction, 2);
  assert.equal(getShotgunDamageReduction(RANGE_BANDS.EXTREME), 3);
});

test('movement modifiers can be applied together', () => {
  const result = getRangedCombatEdges({
    band: RANGE_BANDS.SHORT,
    targetMoved: true,
    firingFromMovingVehicle: true,
  });
  assert.deepEqual(result.modifiers, [
    { id: 'ranged-moving-target', value: -1 },
    { id: 'ranged-moving-vehicle', value: -2 },
  ]);
});

test('stance and defenseless modifiers do not stack prone-target benefits', () => {
  assert.deepEqual(getCloseCombatEdges({ attackerProne: true, targetProne: true }).modifiers, [
    { id: 'close-attacker-prone', value: -2 },
    { id: 'close-target-prone', value: 2 },
  ]);
  assert.deepEqual(getCloseCombatEdges({ targetProne: true, defenseless: true }).modifiers, [
    { id: 'close-defenseless-target', value: 3 },
  ]);
  assert.equal(getCloseCombatEdges({ attackerProne: true }).forcedLocation, 'legs');
});

test('same-hex and one-handed weapon classes follow their specific penalties', () => {
  assert.deepEqual(getRangedCombatEdges({
    band: RANGE_BANDS.SAME_HEX, itemType: 'Pistol', defenseless: false,
  }).modifiers, [{ id: 'ranged-active-same-hex-handy', value: -1 }]);
  assert.deepEqual(getOneHandedRule('Carbine'), { allowed: true, modifier: -2, shortOnly: false });
  assert.deepEqual(getOneHandedRule('Assault Rifle'), { allowed: true, modifier: -3, shortOnly: true });
  assert.equal(getOneHandedRule('GPMG').allowed, false);
});

test('machine guns enforce their carried and support restrictions', () => {
  assert.deepEqual(getMachineGunSupportRule('LMG', {}), {
    machineGun: true, blocked: false, modifier: -2,
  });
  assert.deepEqual(getMachineGunSupportRule('GPMG', { bipod: true }), {
    machineGun: true, blocked: false, modifier: 0,
  });
  assert.equal(getMachineGunSupportRule('HMG', { bipod: true }).blocked, true);
  assert.equal(getMachineGunSupportRule('HMG', { tripod: true }).blocked, false);
});
