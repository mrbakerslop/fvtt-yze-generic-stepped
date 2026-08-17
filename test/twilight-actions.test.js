import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTwilightAction,
  getTwilightActionGroups,
  getTwilightSkillRollActions,
  itemMatchesAction,
  TWILIGHT_ACTIONS,
} from '../src/system/twilight-actions.js';

test('the registry has unique action identifiers and combat plus extended speeds', () => {
  assert.equal(new Set(TWILIGHT_ACTIONS.map(action => action.id)).size, TWILIGHT_ACTIONS.length);
  assert.deepEqual(getTwilightActionGroups().map(group => group.speed), ['slow', 'fast', 'free', 'extended']);
});

test('Urban Operations actions retain their timing and Scene requirements', () => {
  assert.equal(getTwilightAction('spotShooter').speed, 'free');
  assert.equal(getTwilightAction('spotShooter').modifier, 2);
  assert.equal(getTwilightAction('spotSilentShooter').modifier, 0);
  assert.equal(getTwilightAction('enterBuilding').urbanOnly, true);
  assert.equal(getTwilightAction('climbFloor').skill, 'mobility');
  assert.equal(getTwilightAction('breachWallTech').duration, 'shift');
  assert.equal(getTwilightAction('breachWallTech').combatAllowed, false);
  assert.equal(getTwilightAction('monitorRadio').speed, 'extended');
});

test('skill roll actions include relevant tests but leave dedicated weapon workflows alone', () => {
  const mobilityActions = getTwilightSkillRollActions('mobility').map(action => action.id);
  const rangedActions = getTwilightSkillRollActions('rangedCombat').map(action => action.id);
  const closeActions = getTwilightSkillRollActions('closeCombat').map(action => action.id);
  assert.ok(mobilityActions.includes('run'));
  assert.ok(mobilityActions.includes('extinguishFire'));
  assert.ok(!mobilityActions.includes('throwWeapon'));
  assert.ok(rangedActions.includes('overwatchContest'));
  assert.ok(!rangedActions.includes('shootFirearm'));
  assert.ok(!rangedActions.includes('reload'));
  assert.ok(!closeActions.includes('block'));
});

test('manual edge cases use the correct speed and skill', () => {
  assert.equal(getTwilightAction('retreat').skill, 'mobility');
  assert.equal(getTwilightAction('crossLowBarrier').speed, 'fast');
  assert.equal(getTwilightAction('crossHighBarrier').speed, 'slow');
  assert.equal(getTwilightAction('dropProne').speed, 'free');
  assert.equal(getTwilightAction('firstAid').skill, 'medicalAid');
  assert.equal(getTwilightAction('rally').skill, 'command');
  assert.equal(getTwilightAction('diveFromGrenade').workflow, 'diveFromGrenade');
  assert.equal(getTwilightAction('divingBlow').modifier, 2);
  assert.equal(getTwilightAction('divingBlow').workflow, 'divingBlow');
  assert.equal(getTwilightAction('seekPartialCover').target, 'optional');
});

test('social actions use the staged social-conflict workflow', () => {
  for (const id of ['persuade', 'interrogate', 'barter']) {
    assert.equal(getTwilightAction(id).speed, 'slow');
    assert.equal(getTwilightAction(id).workflow, 'socialConflict');
    assert.equal(getTwilightAction(id).target, 'other');
  }
});

test('critical care actions expose their required timing and workflows', () => {
  assert.equal(getTwilightAction('killingBlow').speed, 'slow');
  assert.equal(getTwilightAction('killingBlow').workflow, 'killingBlow');
  assert.equal(getTwilightAction('moveWounded').speed, 'free');
  assert.equal(getTwilightAction('moveWounded').skill, 'medicalAid');
  assert.equal(getTwilightAction('moveWounded').workflow, 'moveWounded');
});

test('action item prerequisites distinguish backpack, ready, and weapon items', () => {
  const backpackGear = { type: 'gear', system: { backpack: true, equipped: false } };
  const readyGear = { type: 'gear', system: { backpack: false, equipped: true } };
  const firearm = {
    type: 'weapon',
    system: { ammo: '9x19', itemType: 'Pistol', props: { heavyWeapon: false } },
  };
  assert.equal(itemMatchesAction(backpackGear, getTwilightAction('getItemFromBackpack')), true);
  assert.equal(itemMatchesAction(readyGear, getTwilightAction('dropHeldItem')), true);
  assert.equal(itemMatchesAction(firearm, getTwilightAction('shootFirearm')), true);
  assert.equal(itemMatchesAction(firearm, getTwilightAction('shootHeavyWeapon')), false);
});
