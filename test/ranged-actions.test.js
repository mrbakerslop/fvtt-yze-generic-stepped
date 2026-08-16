import assert from 'node:assert/strict';
import test from 'node:test';

import { getQuickShotModifier, getRangedPreparation } from '../src/system/ranged-actions.js';

const item = (itemType, props = {}) => ({
  type: 'weapon',
  uuid: `Item.${itemType}`,
  system: { itemType, props },
});

const actor = ({ aim = {}, statuses = [], cover = null } = {}) => ({
  cover,
  statuses: new Set(statuses),
  getFlag: () => aim,
});

test('quick-shot penalties distinguish handy weapons', () => {
  assert.equal(getQuickShotModifier(item('Pistol')), -1);
  assert.equal(getQuickShotModifier(item('Carbine')), -1);
  assert.equal(getQuickShotModifier(item('Hunting Rifle')), -2);
});

test('aim must match both weapon and target', () => {
  const weapon = item('Hunting Rifle');
  const aiming = actor({
    statuses: ['aiming'],
    aim: { mode: 'aim', weaponUuid: weapon.uuid, targetUuid: 'Actor.Target' },
  });
  assert.equal(getRangedPreparation(aiming, weapon, ['Actor.Target']).modifier, 0);
  assert.equal(getRangedPreparation(aiming, weapon, ['Actor.Other']).modifier, -2);
});

test('sniper aim gives one or two dice steps and prohibits ammo dice', () => {
  const weapon = item('Sniper Rifle');
  const aim = { mode: 'aimSniper', weaponUuid: weapon.uuid, targetUuid: 'Actor.Target' };
  const unsupported = getRangedPreparation(actor({ statuses: ['aiming'], aim }), weapon, ['Actor.Target']);
  const supported = getRangedPreparation(
    actor({ statuses: ['aiming', 'prone'], aim }),
    weapon,
    ['Actor.Target'],
  );
  assert.deepEqual({ modifier: unsupported.modifier, noAmmoDice: unsupported.noAmmoDice }, {
    modifier: 1, noAmmoDice: true,
  });
  assert.equal(supported.modifier, 2);
});

test('heavy weapons cannot fire before being aimed', () => {
  const weapon = item('Machine Gun', { heavyWeapon: true });
  assert.equal(getRangedPreparation(actor(), weapon, []).blocked, true);
});
