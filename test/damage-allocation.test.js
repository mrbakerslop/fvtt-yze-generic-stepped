import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDamageAllocation } from '../src/system/damage-allocation.js';

test('the primary hit includes extra base successes and optional ammo-success damage', () => {
  assert.deepEqual(resolveDamageAllocation({
    baseDamage: 2,
    baseSuccesses: 3,
    ammoSuccesses: 4,
    ammoSpend: 2,
  }), {
    available: true,
    primary: true,
    calculatedDamage: 4,
    ammoSpend: 2,
    ammoBonus: 2,
    adjustment: 0,
    damage: 6,
    remainingAmmoSuccesses: 2,
    primaryApplied: true,
    complete: false,
  });
});

test('an additional hit costs one ammo success before further successes increase damage', () => {
  const result = resolveDamageAllocation({
    baseDamage: 2,
    baseSuccesses: 1,
    ammoSuccesses: 3,
    primaryApplied: true,
    ammoSpend: 2,
  });
  assert.equal(result.primary, false);
  assert.equal(result.calculatedDamage, 2);
  assert.equal(result.ammoBonus, 1);
  assert.equal(result.damage, 3);
  assert.equal(result.remainingAmmoSuccesses, 1);
});

test('GM narrative adjustment changes final damage without changing the calculated amount', () => {
  const result = resolveDamageAllocation({
    baseDamage: 3,
    baseSuccesses: 1,
    ammoSuccesses: 0,
    adjustment: -2,
  });
  assert.equal(result.calculatedDamage, 3);
  assert.equal(result.damage, 1);
  assert.equal(result.complete, true);
});

test('a missed attack cannot apply damage from ammo successes', () => {
  assert.deepEqual(resolveDamageAllocation({
    baseDamage: 3,
    baseSuccesses: 0,
    ammoSuccesses: 4,
  }), { available: false, complete: true });
});

test('an additional hit is unavailable after all ammo successes are spent', () => {
  assert.deepEqual(resolveDamageAllocation({
    baseDamage: 3,
    baseSuccesses: 1,
    ammoSuccesses: 0,
    primaryApplied: true,
  }), { available: false, complete: true });
});
