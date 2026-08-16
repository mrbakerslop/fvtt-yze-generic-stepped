import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInternalReloadAmount,
  getReloadModifier,
  getReloadSources,
  isActorInActiveCombat,
  isHeavyWeapon,
  resolveReloadAction,
} from '../src/system/reloading.js';

test('successful firearm reload spends a fast action', () => {
  assert.deepEqual(resolveReloadAction({ inCombat: true, success: true, fast: 1, slow: 1 }), {
    complete: true,
    action: 'fast',
    spentFrom: 'fast',
    forfeited: false,
    unavailable: false,
  });
});

test('successful firearm reload may use the slow action as a second fast action', () => {
  const result = resolveReloadAction({ inCombat: true, success: true, fast: 0, slow: 1 });
  assert.equal(result.action, 'fast');
  assert.equal(result.spentFrom, 'slow');
});

test('failed firearm reload completes as a slow action when available', () => {
  assert.deepEqual(resolveReloadAction({ inCombat: true, success: false, fast: 1, slow: 1 }), {
    complete: true,
    action: 'slow',
    spentFrom: 'slow',
    forfeited: false,
    unavailable: false,
  });
});

test('failed firearm reload forfeits the remaining fast action without reloading', () => {
  assert.deepEqual(resolveReloadAction({ inCombat: true, success: false, fast: 1, slow: 0 }), {
    complete: false,
    action: 'fast',
    spentFrom: 'fast',
    forfeited: true,
    unavailable: false,
  });
});

test('heavy weapon reload always requires a slow action', () => {
  assert.equal(resolveReloadAction({ inCombat: true, heavyWeapon: true, fast: 1, slow: 0 }).unavailable, true);
  assert.equal(resolveReloadAction({ inCombat: true, heavyWeapon: true, slow: 1 }).action, 'slow');
});

test('reloading outside combat does not spend tracked actions', () => {
  assert.deepEqual(resolveReloadAction({ success: false }), {
    complete: true,
    action: null,
    spentFrom: null,
    forfeited: false,
    unavailable: false,
  });
});

test('an actor only counts as in combat after its encounter has started', () => {
  const actor = { id: 'actor-1', uuid: 'Actor.actor-1' };
  const combatant = { actor };
  assert.equal(isActorInActiveCombat(actor, { started: false, combatants: [combatant] }), false);
  assert.equal(isActorInActiveCombat(actor, { started: true, combatants: [combatant] }), true);
  assert.equal(isActorInActiveCombat(actor, { started: true, combatants: [] }), false);
});

test('standard internal reload fills the available capacity', () => {
  assert.equal(getInternalReloadAmount({ loaded: 2, capacity: 5, available: 10 }), 3);
  assert.equal(getInternalReloadAmount({ loaded: 2, capacity: 5, available: 2 }), 2);
});

test('optional granular internal reload loads one round', () => {
  assert.equal(getInternalReloadAmount({ loaded: 2, capacity: 5, available: 10, perRound: true }), 1);
  assert.equal(getInternalReloadAmount({ loaded: 5, capacity: 5, available: 10, perRound: true }), 0);
});

test('heavy weapons are detected by their explicit property or legacy skill', () => {
  assert.equal(isHeavyWeapon({ type: 'weapon', system: { props: { heavyWeapon: true } } }), true);
  assert.equal(isHeavyWeapon(
    { type: 'weapon', system: { props: {} } },
    { getFlag: () => 'heavyWeapons', name: 'Custom Skill Name' },
  ), true);
});

test('reload modifier uses configured action modifiers without double counting the specialty name', () => {
  const actor = {
    getRollModifiers: () => [{ category: 'action', target: 'reload', value: 1 }],
    itemTypes: { specialty: [{ name: 'Reloader' }] },
  };
  assert.equal(getReloadModifier(actor), 1);
  assert.equal(getReloadModifier({
    getRollModifiers: () => [],
    itemTypes: { specialty: [{ name: 'Reload' }] },
  }), 1);
});

test('reload sources include every specialty load sharing the weapon ammunition identifier', () => {
  const standard = {
    id: 'standard',
    type: 'ammunition',
    system: {
      itemType: '12GA',
      ammo: { value: 5, max: 5 },
      props: { magazine: true },
    },
  };
  const slug = {
    id: 'slug',
    type: 'ammunition',
    system: {
      itemType: '12GA',
      ammo: { value: 5, max: 5 },
      override: true,
      props: { magazine: true },
    },
  };
  const dragonsbreath = {
    id: 'dragonsbreath',
    type: 'ammunition',
    system: {
      itemType: '12GA',
      ammo: { value: 5, max: 5 },
      override: true,
      props: { magazine: true },
    },
  };
  const incompatible = {
    id: 'incompatible',
    type: 'ammunition',
    system: {
      itemType: '20GA',
      ammo: { value: 5, max: 5 },
      props: { magazine: true },
    },
  };
  const weapon = {
    type: 'weapon',
    system: {
      ammo: '12GA',
      mag: { target: standard.id },
      props: { magazineFed: true },
    },
  };
  weapon.actor = { itemTypes: { ammunition: [standard, slug, dragonsbreath, incompatible] } };

  assert.deepEqual(getReloadSources(weapon).map(source => source.id), ['slug', 'dragonsbreath']);
});

test('a full internal magazine can switch to a different compatible ammunition type', () => {
  const standard = {
    id: 'standard',
    type: 'ammunition',
    system: { itemType: '12GA', qty: 5, props: {} },
  };
  const slug = {
    id: 'slug',
    type: 'ammunition',
    system: { itemType: '12GA', qty: 5, props: {} },
  };
  const weapon = {
    type: 'weapon',
    system: {
      ammo: '12GA',
      mag: { target: standard.id, value: 5, max: 5 },
      props: { internalMagazine: true },
    },
  };
  weapon.actor = { itemTypes: { ammunition: [standard, slug] } };

  assert.deepEqual(getReloadSources(weapon).map(source => source.id), ['slug']);
});
