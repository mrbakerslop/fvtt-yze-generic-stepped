import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasMatchingAmmunitionType,
  isCompatibleWeaponAmmunition,
  weaponUsesAmmoBelt,
  weaponUsesInternalMagazine,
  weaponUsesMagazine,
} from '../src/system/ammunition-compatibility.js';

const weapon = ({ ammo = '12 Gauge', ammoBelt = false, internalMagazine = false, magazineFed = false } = {}) => ({
  type: 'weapon',
  system: { ammo, props: { ammoBelt, internalMagazine, magazineFed } },
});
const ammunition = ({
  ammoBelt = false,
  ammoBox = false,
  itemType = '12 gauge',
  magazine = false,
} = {}) => ({
  type: 'ammunition',
  system: { itemType, props: { ammoBelt, ammoBox, magazine } },
});

test('belt-fed weapons accept only ammunition belts', () => {
  const beltWeapon = weapon({ ammoBelt: true });
  assert.equal(weaponUsesAmmoBelt(beltWeapon), true);
  assert.equal(isCompatibleWeaponAmmunition(beltWeapon, ammunition({ ammoBelt: true })), true);
  assert.equal(isCompatibleWeaponAmmunition(beltWeapon, ammunition({ magazine: true })), false);
  assert.equal(isCompatibleWeaponAmmunition(beltWeapon, ammunition({ ammoBox: true })), false);
});

test('magazine-fed weapons accept only magazines', () => {
  const magazineWeapon = weapon({ magazineFed: true });
  assert.equal(weaponUsesMagazine(magazineWeapon), true);
  assert.equal(isCompatibleWeaponAmmunition(magazineWeapon, ammunition({ magazine: true })), true);
  assert.equal(isCompatibleWeaponAmmunition(magazineWeapon, ammunition()), false);
  assert.equal(isCompatibleWeaponAmmunition(magazineWeapon, ammunition({ ammoBelt: true })), false);
  assert.equal(isCompatibleWeaponAmmunition(magazineWeapon, ammunition({ ammoBox: true })), false);
});

test('weapons without an external carrier accept only loose ammunition', () => {
  const looseWeapon = weapon();
  assert.equal(isCompatibleWeaponAmmunition(looseWeapon, ammunition()), true);
  assert.equal(isCompatibleWeaponAmmunition(looseWeapon, ammunition({ magazine: true })), false);
  assert.equal(isCompatibleWeaponAmmunition(looseWeapon, ammunition({ ammoBelt: true })), false);
  assert.equal(isCompatibleWeaponAmmunition(looseWeapon, ammunition({ ammoBox: true })), false);
});

test('internal magazines accept loose ammunition but not the weapon self-target', () => {
  const internalWeapon = weapon({ internalMagazine: true });
  assert.equal(weaponUsesInternalMagazine(internalWeapon), true);
  assert.equal(isCompatibleWeaponAmmunition(internalWeapon, ammunition()), true);
  assert.equal(isCompatibleWeaponAmmunition(internalWeapon, ammunition({ magazine: true })), false);
  assert.equal(isCompatibleWeaponAmmunition(internalWeapon, ammunition({ ammoBelt: true })), false);
  assert.equal(isCompatibleWeaponAmmunition(internalWeapon, ammunition({ ammoBox: true })), false);
});

test('ammunition identifiers match without case or whitespace differences', () => {
  const shotgun = weapon({ ammo: '12 Gauge' });
  assert.equal(hasMatchingAmmunitionType(shotgun, ammunition({ itemType: ' 12gauge ' })), true);
  assert.equal(isCompatibleWeaponAmmunition(shotgun, ammunition({ itemType: '20 Gauge' })), false);
  assert.equal(isCompatibleWeaponAmmunition(weapon({ ammo: '' }), ammunition()), false);
  assert.equal(isCompatibleWeaponAmmunition(shotgun, ammunition({ itemType: '' })), false);
});
