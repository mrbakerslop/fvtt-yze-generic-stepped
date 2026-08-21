import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBodyArmorRating,
  getContributingBodyArmor,
  resolveArmorProtection,
} from '../src/system/armor-rules.js';

const armor = (itemName, rating, {
  equipped = true,
  head = false,
  torso = true,
} = {}) => ({
  name: itemName,
  type: 'armor',
  system: {
    equipped,
    rating: { value: rating },
    location: { head, torso, arms: false, legs: false },
  },
});

test('standard body armor uses only the best equipped layer at the hit location', () => {
  const armors = [
    armor('Plate vest', 2),
    armor('Flak jacket', 1),
    armor('Packed vest', 4, { equipped: false }),
    armor('Helmet', 3, { head: true, torso: false }),
  ];

  const contributing = getContributingBodyArmor(armors, 'torso');
  assert.deepEqual(contributing.map(item => item.name), ['Plate vest']);
  assert.equal(getBodyArmorRating(contributing), 2);
});

test('optional stacked body armor adds every equipped layer at the hit location', () => {
  const armors = [
    armor('Plate vest', 2),
    armor('Flak jacket', 1),
    armor('Packed vest', 4, { equipped: false }),
    armor('Helmet', 3, { head: true, torso: false }),
  ];

  const contributing = getContributingBodyArmor(armors, 'torso', { stack: true });
  assert.deepEqual(contributing.map(item => item.name), ['Plate vest', 'Flak jacket']);
  assert.equal(getBodyArmorRating(contributing), 3);
});

test('combined protection applies an armor modifier once', () => {
  const result = resolveArmorProtection({
    amount: 5,
    baseDamage: 3,
    rating: 4,
    modifier: -1,
  });

  assert.equal(result.level, 3);
  assert.equal(result.remaining, 2);
  assert.equal(result.penetrated, true);
});

test('the penetration limit ignores bonus damage when base damage is too low', () => {
  const result = resolveArmorProtection({
    amount: 5,
    baseDamage: 2,
    rating: 4,
  });

  assert.equal(result.passesPenetrationLimit, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.penetrated, false);
});

test('an armor modifier is not applied when no protection exists', () => {
  const result = resolveArmorProtection({
    amount: 3,
    baseDamage: 2,
    rating: 0,
    modifier: 3,
  });

  assert.equal(result.level, 0);
  assert.equal(result.remaining, 3);
});
