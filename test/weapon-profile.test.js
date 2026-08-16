import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AMMUNITION_OVERRIDE_FIELDS,
  getEffectiveWeaponProfile,
} from '../src/system/weapon-profile.js';

const weapon = {
  type: 'weapon',
  system: {
    damage: 2,
    crit: 3,
    blast: '–',
    range: 4,
    armorModifier: -1,
  },
};

test('weapon profile uses base features without overriding ammunition', () => {
  const ammunition = {
    id: 'standard-ammo',
    name: 'Standard Ammunition',
    type: 'ammunition',
    system: {
      override: false,
      damage: 9,
      crit: 9,
      blast: 'A',
      range: 9,
      armorModifier: 9,
    },
  };

  assert.deepEqual(getEffectiveWeaponProfile(weapon, ammunition), {
    damage: 2,
    crit: 3,
    blast: '–',
    range: 4,
    armorModifier: -1,
    ammunitionId: 'standard-ammo',
    ammunitionName: 'Standard Ammunition',
    overridden: false,
  });
});

test('overriding ammunition replaces every attack feature, including zero values', () => {
  const ammunition = {
    id: 'ap-ammo',
    name: 'AP Ammunition',
    type: 'ammunition',
    system: {
      override: true,
      damage: 3,
      crit: 4,
      blast: '–',
      range: 5,
      armorModifier: 0,
    },
  };

  const profile = getEffectiveWeaponProfile(weapon, ammunition);

  assert.deepEqual(
    Object.fromEntries(AMMUNITION_OVERRIDE_FIELDS.map(field => [field, profile[field]])),
    { damage: 3, crit: 4, blast: '–', range: 5, armorModifier: 0 },
  );
  assert.equal(profile.ammunitionId, 'ap-ammo');
  assert.equal(profile.ammunitionName, 'AP Ammunition');
  assert.equal(profile.overridden, true);
  assert.equal(weapon.system.damage, 2);
});
