/* global globalThis */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryRuntime } from './helpers/foundry-runtime.js';

installFoundryRuntime();
const { default: ActorYZEGS } = await import('../src/actor/actor.js');
const {
  advanceEnvironmentalWorldTime, advanceCombatFire, applyHazardRegion, synchronizeConditionTimers,
  resolveHypothermiaCheck,
} = await import('../src/system/environmental-hazards.js');
const { advanceDiseaseWorldTime, actorRecoveryBlocked } = await import('../src/system/disease-workflows.js');
const { resolveColdWaterCheck } = await import('../src/system/water-environment.js');
const { setHypothermia } = await import('../src/system/hypothermia.js');
const { YZEGSRoller } = await import('../src/components/roll/dice.js');
const { coverAppliesAgainst, coverProtectsLocation } = await import('../src/system/defense.js');

const DAY = 86400;
function fixture({ condition = 'dehydrated', since = 0, sanity = 4 } = {}) {
  const runtime = installFoundryRuntime();
  const primary = { id: 'gm-a', active: true, isGM: true };
  const secondary = { id: 'gm-b', active: true, isGM: true };
  game.users.set(secondary.id, secondary);
  game.users.set(primary.id, primary);
  game.user = primary;
  game.time = { worldTime: since };
  ChatMessage.create = async data => data;
  ChatMessage.getSpeaker = () => ({});
  const flags = { conditionTimers: { [condition]: { since, lastHarm: since } } };
  const actor = {
    type: 'character', name: 'Patient', uuid: 'Actor.patient',
    system: {
      conditions: { [condition]: true }, health: { value: 5 }, sanity: { value: sanity },
      attributes: { str: { value: 8 } }, rads: { temporary: 0 },
    },
    statuses: new Set(), effects: [], items: [], itemTypes: { disease: [] },
    getFlag: (_ns, key) => flags[key],
    async setFlag(_ns, key, value) { flags[key] = value; },
    async unsetFlag(_ns, key) { delete flags[key]; },
    async update(data) {
      for (const [key, value] of Object.entries(data)) foundry.utils.setProperty(this, key, value);
      return this;
    },
    async toggleStatusEffect(key, { active }) {
      if (active) this.statuses.add(key);
      else this.statuses.delete(key);
    },
    getSkill: () => ({
      id: 'stamina', type: 'skill', name: 'Stamina',
      system: { attribute: 'str', value: 6, combatType: 'none' }, getFlag: () => '',
    }),
  };
  game.actors.set('patient', actor);
  return { actor, flags, primary, secondary, runtime };
}

test('modern cover statuses supply protection and inactive legacy effects do not', () => {
  fixture();
  const actor = new ActorYZEGS({
    effects: [], statuses: new Set(['fullCover']),
    getFlag: () => ({ armor: 4, againstUuid: 'Actor.attacker' }),
  });
  assert.equal(actor.cover, 'fullCover');
  assert.equal(actor.coverDetails.armor, 4);
  assert.equal(coverAppliesAgainst(actor.coverDetails, 'Actor.attacker'), true);
  assert.equal(coverProtectsLocation(actor.cover, 'head'), true);
  actor.statuses = new Set(['partialCover']);
  assert.equal(actor.cover, 'partialCover');
  assert.equal(coverProtectsLocation(actor.cover, 'head'), false);
  assert.equal(coverProtectsLocation(actor.cover, 'torso'), true);
  actor.statuses.clear();
  actor.effects = [{ disabled: true, getFlag: () => 'fullCover' }];
  assert.equal(actor.cover, null);
  actor.effects[0].disabled = false;
  actor.effects[0].isSuppressed = true;
  assert.equal(actor.cover, null);
  actor.effects[0].isSuppressed = false;
  assert.equal(actor.cover, 'fullCover');
});

for (const [condition, interval] of [['dehydrated', DAY], ['starving', 7 * DAY], ['sleepless', DAY]]) {
  test(`${condition} accrues harm from time zero, preserves remainder, and does not repeat ticks`, async () => {
    const { actor, flags, primary } = fixture({ condition });
    flags.conditionTimers = {};
    await synchronizeConditionTimers(actor, { system: { conditions: { [condition]: true } } });
    assert.equal(flags.conditionTimers[condition].lastHarm, 0);
    const track = condition === 'sleepless' ? 'sanity' : 'health';
    const initial = actor.system[track].value;
    game.time.worldTime = interval - 1;
    await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
    assert.equal(actor.system[track].value, initial);
    game.time.worldTime = interval * 2 + 50;
    await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
    assert.equal(actor.system[track].value, initial - 2);
    assert.equal(flags.conditionTimers[condition].lastHarm, interval * 2);
    await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
    game.time.worldTime = interval;
    await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
    assert.equal(actor.system[track].value, initial - 2);
  });
}

test('radiation decay preserves a zero timestamp and consumes only complete days', async () => {
  const { actor, flags, primary } = fixture();
  actor.system.conditions = {};
  actor.system.rads.temporary = 4;
  await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
  assert.equal(flags.radiationDecayAt, 0);
  game.time.worldTime = DAY * 2 + 10;
  await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
  assert.equal(actor.system.rads.temporary, 2);
  assert.equal(flags.radiationDecayAt, DAY * 2);
});

test('sleeplessness applies sleep only at zero remaining sanity', async () => {
  const { actor, primary } = fixture({ condition: 'sleepless', sanity: 2 });
  game.time.worldTime = DAY;
  await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
  assert.equal(actor.system.sanity.value, 1);
  assert.equal(actor.statuses.has('sleep'), false);
  game.time.worldTime = DAY * 2;
  await advanceEnvironmentalWorldTime(0, 0, {}, primary.id);
  assert.equal(actor.system.sanity.value, 0);
  assert.equal(actor.statuses.has('sleep'), true);
});

test('secondary-GM time updates are processed exactly once by the elected GM', async () => {
  const { actor, primary, secondary } = fixture();
  const disease = {
    system: { state: { phase: 'incubating', due: false, dueWorldTime: DAY } },
    updates: 0,
    async update(data) {
      this.updates++;
      for (const [key, value] of Object.entries(data)) foundry.utils.setProperty(this, key, value);
    },
  };
  actor.itemTypes.disease.push(disease);
  game.time.worldTime = DAY;
  for (const user of [secondary, primary]) {
    game.user = user;
    await advanceEnvironmentalWorldTime(DAY, DAY, {}, secondary.id);
    await advanceDiseaseWorldTime(DAY, DAY, {}, secondary.id);
  }
  assert.equal(actor.system.health.value, 4);
  assert.equal(disease.updates, 1);
  assert.equal(disease.system.state.due, true);
});

test('secondary-GM combat updates resolve ongoing fire on one client', async () => {
  const { actor, flags, primary, secondary } = fixture();
  actor.statuses.add('fire');
  flags.fireHazard = { intensity: 'C' };
  let rolls = 0;
  globalThis.Roll = class {
    async evaluate() {
      rolls++;
      this.dice = [];
      return this;
    }
    async toMessage() { return this; }
  };
  for (const user of [secondary, primary]) {
    game.user = user;
    await advanceCombatFire({ combatant: { actor } }, { turn: 1 }, secondary.id);
  }
  assert.equal(rolls, 1);
});

test('cold-water hypothermia blocks recovery and clearing it removes the status', async () => {
  const { actor } = fixture();
  actor.system.conditions = { hypothermic: false };
  const original = YZEGSRoller.taskCheck;
  try {
    YZEGSRoller.taskCheck = async () => ({ rolls: [{ baseSuccessQty: 0 }] });
    await resolveColdWaterCheck(actor);
    assert.equal(actor.system.conditions.hypothermic, true);
    assert.equal(actor.statuses.has('hypothermia'), true);
    assert.equal(actorRecoveryBlocked(actor), true);
    YZEGSRoller.taskCheck = async () => ({ successCount: 1, async toMessage() { return this; } });
    assert.deepEqual(await resolveHypothermiaCheck(actor), { success: true });
    await setHypothermia(actor, false);
    assert.equal(actor.system.conditions.hypothermic, false);
    assert.equal(actor.statuses.has('hypothermia'), false);
    assert.equal(actorRecoveryBlocked(actor), false);
    await applyHazardRegion(actor, { hazardType: 'cold' });
    assert.equal(actor.system.conditions.hypothermic, true);
    assert.equal(actor.statuses.has('hypothermia'), true);
  }
  finally { YZEGSRoller.taskCheck = original; }
});

test('sheet recovery and disabled hypothermia effects synchronize without duplicate status creation', async () => {
  const { actor, primary, runtime } = fixture();
  await import('../src/yzegs.js');
  actor.system.conditions = { hypothermic: false };
  let toggles = 0;
  actor.update = async (data, options = {}) => {
    for (const [key, value] of Object.entries(data)) foundry.utils.setProperty(actor, key, value);
    await runtime.trigger('updateActor', actor, foundry.utils.expandObject(data), options, primary.id);
    return actor;
  };
  actor.toggleStatusEffect = async (key, { active }) => {
    toggles++;
    if (active) actor.statuses.add(key);
    else actor.statuses.delete(key);
    const effect = { parent: actor, statuses: new Set([key]) };
    await runtime.trigger(active ? 'createActiveEffect' : 'deleteActiveEffect', effect, {}, primary.id);
  };
  // The runtime stub normally leaves dotted paths untouched; model Foundry's expanded hook payload here.
  foundry.utils.expandObject = data => {
    const expanded = {};
    for (const [key, value] of Object.entries(data)) foundry.utils.setProperty(expanded, key, value);
    return expanded;
  };
  await setHypothermia(actor, true);
  assert.equal(toggles, 1);
  await actor.update({ 'system.conditions.hypothermic': false });
  assert.equal(toggles, 2);
  assert.equal(actor.statuses.has('hypothermia'), false);
  await setHypothermia(actor, true);
  actor.statuses.delete('hypothermia');
  await runtime.trigger('updateActiveEffect', {
    parent: actor, statuses: new Set(['hypothermia']), disabled: true,
  }, { disabled: true }, {}, primary.id);
  assert.equal(actor.system.conditions.hypothermic, false);
  assert.equal(actorRecoveryBlocked(actor), false);
});
