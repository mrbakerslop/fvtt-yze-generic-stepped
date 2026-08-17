import YZEGSDialog from '../components/dialog/dialog.js';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getActorActionSkill, getActionSkillName } from './action-skills.js';
import { isActorInActiveCombat } from './reloading.js';
import {
  CRITICAL_TIME_SECONDS,
  criticalSeverityDice,
  nextStabilizationStage,
  normalizeTimeLimit,
} from './critical-injury-rules.js';

export { criticalSeverityDice, nextStabilizationStage, normalizeTimeLimit };

export const SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const CRITICAL_INJURIES_ENABLED_SETTING = 'criticalInjuriesEnabled';
export const CRITICAL_INJURY_TABLE_SETTINGS = Object.freeze({
  head: 'criticalInjuryTableHead',
  arms: 'criticalInjuryTableArms',
  torso: 'criticalInjuryTableTorso',
  legs: 'criticalInjuryTableLegs',
});
export const CRITICAL_INJURY_TABLE_DEFAULTS = Object.freeze({
  head: 'Compendium.fvtt-yze-generic-stepped.system-roll-tables.RollTable.0nPPY00CeVmVzGIK',
  arms: 'Compendium.fvtt-yze-generic-stepped.system-roll-tables.RollTable.xSEtPxePu9l3asc2',
  torso: 'Compendium.fvtt-yze-generic-stepped.system-roll-tables.RollTable.fqy2m5acARwtTF7r',
  legs: 'Compendium.fvtt-yze-generic-stepped.system-roll-tables.RollTable.xJ7hINFO19jLeifK',
});

const MOVEMENT_ACTIONS = new Set([
  'run', 'crawl', 'retreat', 'crossLowBarrier', 'crossHighBarrier', 'moveThroughDoor',
  'enterBuilding', 'moveSector', 'moveIndoorHex', 'changeFloor', 'climbFloor', 'swim',
]);

function localize(key, data = null) {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

function hasStatus(actor, statusId) {
  return actor?.statuses?.has?.(statusId)
    || actor?.effects?.some(effect => effect.statuses?.has?.(statusId))
    || false;
}

async function setStatus(actor, statusId, active) {
  if (!actor || hasStatus(actor, statusId) === active) return false;
  await actor.toggleStatusEffect(statusId, { active });
  return true;
}

/** Rules state derived from the Actor's two capacity tracks. */
export function getActorImpairment(actor) {
  const dead = hasStatus(actor, 'dead');
  const damage = !dead && Number(actor?.system?.health?.value) <= 0;
  const stress = !dead && Number(actor?.system?.sanity?.value) <= 0;
  return { dead, damage, stress, incapacitated: damage || stress };
}

/** Whether an incapacitated Actor may attempt a registry action. */
export function canActorAttemptAction(actor, actionId) {
  const state = getActorImpairment(actor);
  if (state.dead) return false;
  if (state.damage) return actionId === 'crawl';
  if (state.stress) return ['run', 'seekPartialCover', 'seekFullCover'].includes(actionId);
  return true;
}

/** Whether a roll is permitted while the Actor is incapacitated. */
export function canActorRoll(actor, { checkType = '', allowWhileIncapacitated = false } = {}) {
  const state = getActorImpairment(actor);
  if (state.dead) return false;
  if (!state.incapacitated) return true;
  return allowWhileIncapacitated || checkType === 'deathSave';
}

export function injuryDueAtWorldTime(stage, worldTime = game.time.worldTime) {
  return Number(worldTime) + (CRITICAL_TIME_SECONDS[stage] ?? 0);
}

function injuryState(injury) {
  return injury?.system?.state ?? {};
}

export function isUnstableLethalInjury(injury) {
  const state = injuryState(injury);
  return injury?.type === 'injury' && injury.system.lethal && !injury.system.instantDeath
    && !['dead', 'stabilized'].includes(state.stage);
}

export function getUnstableLethalInjuries(actor) {
  return [...(actor?.itemTypes?.injury ?? [])].filter(isUnstableLethalInjury);
}

export function actorHasCriticalEffect(actor, effectId) {
  return [...(actor?.itemTypes?.injury ?? [])].some(injury => (
    injury.system.state?.active && injury.system.effects?.includes(effectId)
  ));
}

function combatDeadline(actor, combat) {
  const combatant = combat?.combatants?.find(entry => entry.actorId === actor.id);
  return {
    combatId: combat?.id ?? '',
    combatantId: combatant?.id ?? '',
    scheduledRound: Number(combat?.round) || 0,
    scheduledTurn: Number(combat?.turn) || 0,
  };
}

function scheduleData(actor, stage) {
  const activeCombat = stage === 'round' && isActorInActiveCombat(actor, game.combat);
  return {
    due: false,
    dueWorldTime: activeCombat ? 0 : injuryDueAtWorldTime(stage),
    ...(activeCombat ? combatDeadline(actor, game.combat) : {
      combatId: '', combatantId: '', scheduledRound: 0, scheduledTurn: 0,
    }),
  };
}

function inferEffects(hitLocation, result) {
  const effects = [];
  if (hitLocation === 'arms') effects.push('dropHeld');
  if (hitLocation === 'legs') effects.push('prone');
  if (hitLocation === 'head' && result === 8) effects.push('immobile');
  if (hitLocation === 'torso' && [7, 9].includes(result)) effects.push('immobile');
  if (hitLocation === 'arms' && [4, 5, 6, 8, 10].includes(result)) effects.push('noTwoHanded');
  if (hitLocation === 'legs' && [2, 4, 5, 6, 8, 10].includes(result)) effects.push('noRun');
  if ((hitLocation === 'head' || hitLocation === 'torso') && result === 10) effects.push('instantDeath');
  return effects;
}

async function resolveDocument(uuid) {
  try { return uuid ? await fromUuid(uuid) : null; }
  catch (_error) { return null; }
}

async function rollHighestD10(dice) {
  const roll = await new Roll(`${dice}d10`).evaluate();
  const results = roll.dice.flatMap(die => die.results.map(result => Number(result.result)));
  return { roll, result: Math.max(...results) };
}

async function resolveCriticalSource(hitLocation, result) {
  const setting = CRITICAL_INJURY_TABLE_SETTINGS[hitLocation];
  const uuid = setting ? game.settings.get(SYSTEM_ID, setting) : '';
  const table = await resolveDocument(uuid);
  if (!table) throw new Error(localize('YZEGS.Critical.Errors.TableMissing', { location: hitLocation }));
  const tableResult = table.results.find(entry => {
    const range = entry.range ?? [];
    return result >= Number(range[0]) && result <= Number(range[1]);
  });
  const documentUuid = tableResult?.documentUuid
    || tableResult?.getFlag?.('core', 'documentUuid')
    || tableResult?.flags?.core?.documentUuid;
  const source = await resolveDocument(documentUuid);
  if (!source || source.type !== 'injury') {
    throw new Error(localize('YZEGS.Critical.Errors.ResultMissing', { result }));
  }
  return source;
}

async function applyImmediateEffects(actor, effects) {
  if (effects.includes('prone')) await setStatus(actor, 'prone', true);
  if (effects.includes('immobile')) await setStatus(actor, 'immobile', true);
  if (effects.includes('dropHeld')) {
    const held = actor.items.filter(item => item.system?.equipped);
    await Promise.all(held.map(item => item.update({ 'system.equipped': false })));
  }
}

async function postCriticalCard(actor, injury, { damage, criticalRating, dice, result }) {
  const state = injuryState(injury);
  const content = `<div class="yzegs chat-card critical-injury-card">
    <h3><i class="fa-solid fa-kit-medical"></i> ${localize('YZEGS.Critical.Title')}</h3>
    <p><strong>${actor.name}</strong>: ${injury.name}</p>
    <p>${localize('YZEGS.Critical.RollSummary', { damage, criticalRating, dice, result })}</p>
    ${injury.system.lethal ? `<p class="critical-lethal"><strong>${localize('YZEGS.Critical.Lethal')}</strong>
      — ${localize(`YZEGS.Critical.Stage.${state.stage}`)}</p>` : ''}
    ${state.healingDays ? `<p>${localize('YZEGS.Critical.HealingDays', { days: state.healingDays })}</p>` : ''}
  </div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

async function rollHealingDays(formula) {
  if (!String(formula ?? '').trim()) return 0;
  try {
    const roll = await new Roll(String(formula)).evaluate();
    return Math.max(0, Number(roll.total) || 0);
  }
  catch (_error) { return 0; }
}

/** Create and apply a critical Injury generated by final post-protection damage. */
export async function applyCriticalInjury(actor, { damage, criticalRating, location: hitLocation }) {
  if (!game.settings.get(SYSTEM_ID, CRITICAL_INJURIES_ENABLED_SETTING)) return null;
  const dice = criticalSeverityDice(damage, criticalRating);
  if (!dice || !CRITICAL_INJURY_TABLE_SETTINGS[hitLocation]) return null;
  const { result } = await rollHighestD10(dice);
  const source = await resolveCriticalSource(hitLocation, result);
  const data = source.toObject();
  delete data._id;
  const effects = [...new Set([...(data.system.effects ?? []), ...inferEffects(hitLocation, result)])];
  const instantDeath = Boolean(data.system.instantDeath) || effects.includes('instantDeath');
  const stage = instantDeath ? 'dead' : (normalizeTimeLimit(data.system.timeLimit) || 'shift');
  data.system.effects = effects;
  data.system.instantDeath = instantDeath;
  data.system.state = {
    active: true,
    severityDice: dice,
    rolledResult: result,
    stage: data.system.lethal ? stage : '',
    stabilized: false,
    stabilizationLocked: false,
    deathSaveCount: 0,
    healingDays: await rollHealingDays(data.system.healTime),
    treatment: {},
    ...(data.system.lethal && !instantDeath ? scheduleData(actor, stage) : {}),
  };
  const [injury] = await actor.createEmbeddedDocuments('Item', [data]);
  await applyImmediateEffects(actor, effects);
  if (instantDeath) await killActor(actor, { reason: injury.name });
  await postCriticalCard(actor, injury, { damage, criticalRating, dice, result });
  return injury;
}

/** Apply the fixed severe-burn critical caused by taking two or more fire damage. */
export async function applyFireCriticalInjury(actor, { damage = 2 } = {}) {
  const existing = (actor.itemTypes.injury ?? []).find(entry => (
    entry.getFlag(SYSTEM_ID, 'fireCritical') && entry.system.state?.active
  ));
  if (existing) return existing;
  const rollModifiers = {};
  for (const legacyKey of ['stamina', 'mobility']) {
    const skill = actor.getSkill?.(legacyKey);
    if (!skill) continue;
    rollModifiers[legacyKey] = { name: `skill.${skill.id}`, value: -2 };
  }
  const state = {
    active: true,
    severityDice: 0,
    rolledResult: 0,
    stage: 'stretch',
    stabilized: false,
    stabilizationLocked: false,
    deathSaveCount: 0,
    healingDays: await rollHealingDays('2d6'),
    treatment: {},
    ...scheduleData(actor, 'stretch'),
  };
  const [injury] = await actor.createEmbeddedDocuments('Item', [{
    name: localize('YZEGS.Hazards.SevereBurns'),
    type: 'injury',
    system: {
      category: 'physical',
      location: 'torso',
      lethal: true,
      instantDeath: false,
      timeLimit: 'Stretch',
      healTime: '2d6',
      description: localize('YZEGS.Hazards.SevereBurnsEffect'),
      effects: [],
      rollModifiers,
      state,
    },
    flags: { [SYSTEM_ID]: { fireCritical: true } },
  }]);
  await postCriticalCard(actor, injury, { damage, criticalRating: 2, dice: 0, result: 0 });
  return injury;
}

export async function synchronizeIncapacitation(actor) {
  if (!['character', 'npc'].includes(actor?.type)) return;
  const state = getActorImpairment(actor);
  await setStatus(actor, 'incapacitatedDamage', state.damage);
  await setStatus(actor, 'incapacitatedStress', state.stress);
}

export async function synchronizeCriticalEffects(actor) {
  if (!['character', 'npc'].includes(actor?.type)) return;
  await setStatus(actor, 'immobile', actorHasCriticalEffect(actor, 'immobile'));
}

export async function initializeOwnedInjury(actor, injury) {
  if (!actor || injury?.type !== 'injury' || injury.system.state?.active) return false;
  const healingDays = Number(injury.system.state?.healingDays)
    || await rollHealingDays(injury.system.healTime);
  if (!injury.system.lethal) {
    await injury.update({
      'system.state.active': true,
      'system.state.healingDays': healingDays,
    });
    return true;
  }
  const instantDeath = Boolean(injury.system.instantDeath);
  const stage = instantDeath ? 'dead' : (normalizeTimeLimit(injury.system.timeLimit) || 'shift');
  await injury.update({
    'system.state.active': true,
    'system.state.stage': stage,
    'system.state.healingDays': healingDays,
    ...(instantDeath ? {} : Object.fromEntries(
      Object.entries(scheduleData(actor, stage)).map(([key, value]) => [`system.state.${key}`, value]),
    )),
  });
  if (instantDeath) await killActor(actor, { reason: injury.name });
  return true;
}

export async function initializeCriticalStates() {
  if (!game.user.isGM) return;
  for (const actor of game.actors.filter(entry => ['character', 'npc'].includes(entry.type))) {
    for (const injury of actor.itemTypes.injury ?? []) await initializeOwnedInjury(actor, injury);
    await synchronizeIncapacitation(actor);
    await synchronizeCriticalEffects(actor);
  }
}

export async function handleCriticalCombatEnd(combat, userId) {
  if (!game.user.isGM || userId !== game.user.id) return;
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    for (const injury of getUnstableLethalInjuries(actor)) {
      const state = injuryState(injury);
      if (state.stage !== 'round' || state.combatId !== combat.id || state.due) continue;
      await injury.update({
        'system.state.combatId': '',
        'system.state.combatantId': '',
        'system.state.dueWorldTime': injuryDueAtWorldTime('round'),
      });
    }
  }
}

export async function killActor(actor, { reason = '' } = {}) {
  await setStatus(actor, 'dead', true);
  await actor.update({ 'system.health.value': 0 });
  const content = `<div class="yzegs chat-card critical-injury-card"><h3><i class="fa-solid fa-skull"></i>
    ${localize('YZEGS.Critical.Death')}</h3><p><strong>${actor.name}</strong>${reason ? ` — ${reason}` : ''}</p></div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

async function postDeadlinePrompt(actor, injury) {
  const content = `<div class="yzegs chat-card critical-injury-card" data-actor-id="${actor.id}">
    <h3>${localize('YZEGS.Critical.DeathSaveDue')}</h3><p><strong>${actor.name}</strong>: ${injury.name}</p>
    <button class="dice-button critical-death-save" data-owner-uuid="${actor.uuid}"
      data-actor-uuid="${actor.uuid}" data-injury-id="${injury.id}">
      <i class="fa-solid fa-dice"></i> ${localize('YZEGS.Critical.RollDeathSave')}</button></div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

async function markDue(actor, injury) {
  if (injuryState(injury).due) return false;
  await injury.update({ 'system.state.due': true });
  await postDeadlinePrompt(actor, injury);
  return true;
}

/** Advance round-based lethal deadlines when a patient's next turn begins. */
export async function advanceCriticalInjuryCombat(combat, changes, userId) {
  const advanced = Object.hasOwn(changes, 'turn') || Object.hasOwn(changes, 'round');
  if (!game.user.isGM || userId !== game.user.id || !advanced) return;
  const actor = combat.combatant?.actor;
  if (!actor) return;
  for (const injury of getUnstableLethalInjuries(actor)) {
    const state = injuryState(injury);
    if (state.stage !== 'round' || state.combatId !== combat.id || state.due) continue;
    const laterRound = Number(combat.round) > Number(state.scheduledRound);
    const laterTurn = Number(combat.round) === Number(state.scheduledRound)
      && Number(combat.turn) > Number(state.scheduledTurn);
    if ((laterRound || laterTurn) && combat.combatant?.id === state.combatantId) await markDue(actor, injury);
  }
}

/** Advance stretch/shift deadlines and timed stabilization treatments. */
export async function advanceCriticalInjuryWorldTime(worldTime, _delta, _options, userId) {
  if (!game.user.isGM || userId !== game.user.id) return;
  for (const actor of game.actors.filter(entry => ['character', 'npc'].includes(entry.type))) {
    for (const injury of getUnstableLethalInjuries(actor)) {
      const state = injuryState(injury);
      if (!state.due && state.dueWorldTime && Number(worldTime) >= Number(state.dueWorldTime)) {
        await markDue(actor, injury);
      }
      if (state.treatment?.dueWorldTime && !state.treatment.ready
        && Number(worldTime) >= Number(state.treatment.dueWorldTime)) {
        await injury.update({ 'system.state.treatment.ready': true });
        ui.notifications.info(localize('YZEGS.Critical.TreatmentReady', { name: actor.name }));
      }
    }
  }
}

async function updateRollMessage(message, roll) {
  const content = await roll.render();
  return message.update({ content, rolls: [JSON.stringify(roll)] });
}

function configuredSkill(actor, id, fallback) {
  const skill = getActorActionSkill(actor, id, fallback);
  if (!skill) {
    ui.notifications.warn(localize('YZEGS.CombatActions.Errors.SkillMissing', {
      skill: getActionSkillName(id, fallback),
    }));
  }
  return skill;
}

export async function rollDeathSave(actor, injury) {
  if (!actor || !injury || !isUnstableLethalInjury(injury)) return null;
  const skill = configuredSkill(actor, 'deathSave', 'stamina');
  if (!skill) return null;
  const incapacitated = getActorImpairment(actor).incapacitated;
  return YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, actor),
    title: localize('YZEGS.Critical.DeathSaveTitle', { name: actor.name }),
    actor,
    checkType: 'deathSave',
    allowWhileIncapacitated: true,
    maxPush: incapacitated ? 0 : 1,
    lockMaxPush: incapacitated,
    hideCombatActions: true,
    actionData: {
      criticalOutcome: 'deathSave', actorUuid: actor.uuid, injuryId: injury.id, applied: false,
    },
  });
}

async function rescheduleDeathSave(actor, injury) {
  const stage = injuryState(injury).stage;
  await injury.update({
    'system.state.due': false,
    'system.state.stabilizationLocked': false,
    'system.state.deathSaveCount': Number(injuryState(injury).deathSaveCount) + 1,
    ...Object.fromEntries(
      Object.entries(scheduleData(actor, stage)).map(([key, value]) => [`system.state.${key}`, value]),
    ),
  });
}

export async function resolveCriticalRoll(message) {
  const roll = message?.rolls?.[0];
  const data = roll?.options?.actionData;
  if (!data?.criticalOutcome || data.applied) return false;
  const actor = await resolveDocument(data.actorUuid);
  const injury = actor?.items?.get(data.injuryId);
  const roller = await resolveDocument(roll.options.actorUuid);
  if (!actor || (!game.user.isGM && !actor.isOwner && !roller?.isOwner)) return false;
  const success = Number(roll.baseSuccessQty) > 0;
  if (data.criticalOutcome === 'deathSave') {
    if (!injury) return false;
    if (success) await rescheduleDeathSave(actor, injury);
    else await killActor(actor, { reason: injury.name });
  }
  else if (data.criticalOutcome === 'stabilize') {
    if (!injury) return false;
    if (success) {
      const stage = nextStabilizationStage(injuryState(injury).stage);
      await injury.update({
        'system.state.stage': stage,
        'system.state.stabilized': stage === 'stabilized',
        'system.state.due': false,
        'system.state.stabilizationLocked': false,
        'system.state.treatment': {},
        ...(stage !== 'stabilized' ? Object.fromEntries(
          Object.entries(scheduleData(actor, stage)).map(([key, value]) => [`system.state.${key}`, value]),
        ) : {}),
      });
    }
    else {
      await injury.update({
        'system.state.stabilizationLocked': true,
        'system.state.treatment': {},
      });
    }
  }
  else if (data.criticalOutcome === 'moveWounded') {
    if (!injury) return false;
    if (!success) await rollDeathSave(actor, injury);
  }
  else if (data.criticalOutcome === 'selfMovement') {
    if (!injury) return false;
    await rollDeathSave(actor, injury);
  }
  else if (data.criticalOutcome === 'killingBlow') {
    const target = await resolveDocument(data.targetUuid);
    if (!target) return false;
    if (success) {
      ui.notifications.info(localize('YZEGS.Critical.KillingBlowRefused'));
    }
    else {
      await killActor(target, { reason: localize('YZEGS.ActionNames.killingBlow') });
      const sanity = Math.max(0, Number(actor.system.sanity?.value) - 1);
      await actor.update({ 'system.sanity.value': sanity });
    }
  }
  data.applied = true;
  roll.options.actionData = data;
  await updateRollMessage(message, roll);
  return true;
}

async function chooseHealer(patient) {
  const choices = game.actors.filter(actor => (
    ['character', 'npc'].includes(actor.type) && (game.user.isGM || actor.isOwner)
  ));
  const options = Object.fromEntries(choices.map(actor => [actor.uuid, actor.name]));
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/actor-choice-dialog.hbs',
    { actors: options, label: localize('YZEGS.Critical.Healer'), selected: patient.uuid },
  );
  const result = await YZEGSDialog._wait({
    title: localize('YZEGS.Critical.Stabilize'),
    content,
    actionLabel: localize('YZEGS.Critical.BeginTreatment'),
    processForm: form => ({ actor: form.elements.namedItem('actor')?.value ?? '' }),
  });
  return result.cancelled ? null : resolveDocument(result.actor);
}

export async function beginStabilization(patient, injury) {
  if (!isUnstableLethalInjury(injury) || injuryState(injury).stabilizationLocked) return null;
  const healer = await chooseHealer(patient);
  if (!healer) return null;
  if (healer.uuid === patient.uuid && getActorImpairment(patient).incapacitated) {
    ui.notifications.warn(localize('YZEGS.Critical.Errors.CannotTreatSelf'));
    return null;
  }
  const stage = injuryState(injury).stage;
  const inCombat = stage === 'round' && isActorInActiveCombat(healer, game.combat);
  if (inCombat) {
    const slow = Number(healer.system.actions?.slow?.value) || 0;
    if (slow < 1) {
      ui.notifications.warn(localize('YZEGS.CombatActions.NoSlowAction'));
      return null;
    }
    await healer.update({ 'system.actions.slow.value': slow - 1 });
    return rollStabilization(patient, injury, healer);
  }
  const seconds = CRITICAL_TIME_SECONDS[stage] ?? 0;
  if (seconds > 0) {
    await injury.update({
      'system.state.treatment': {
        healerUuid: healer.uuid,
        healerName: healer.name,
        dueWorldTime: Number(game.time.worldTime) + seconds,
        ready: false,
      },
    });
    ui.notifications.info(localize('YZEGS.Critical.TreatmentStarted', { name: patient.name }));
    return true;
  }
  return rollStabilization(patient, injury, healer);
}

export async function rollStabilization(patient, injury, healer = null) {
  const treatment = injuryState(injury).treatment ?? {};
  healer = healer ?? await resolveDocument(treatment.healerUuid);
  if (!healer || !isUnstableLethalInjury(injury)) return null;
  if (treatment.dueWorldTime && !treatment.ready && !game.user.isGM) {
    ui.notifications.warn(localize('YZEGS.Critical.Errors.TreatmentNotReady'));
    return null;
  }
  const skill = configuredSkill(healer, 'stabilizeCritical', 'medicalAid');
  if (!skill) return null;
  const treatingSelf = healer.uuid === patient.uuid;
  return YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, healer),
    title: localize('YZEGS.Critical.StabilizeTitle', { name: patient.name }),
    actor: healer,
    modifier: treatingSelf ? -2 : 0,
    hideCombatActions: true,
    allowWhileIncapacitated: false,
    actionData: {
      criticalOutcome: 'stabilize', actorUuid: patient.uuid, injuryId: injury.id, applied: false,
    },
  });
}

/** Trigger an immediate save after an unstable lethally injured patient moves. */
export async function checkLethalMovement(actor, actionId) {
  if (!MOVEMENT_ACTIONS.has(actionId)) return null;
  const injury = getUnstableLethalInjuries(actor)[0];
  return injury ? rollDeathSave(actor, injury) : null;
}

export async function handleCriticalChatButton(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (button.classList.contains('resolve-critical-roll')) {
      const messageId = button.closest('.chat-message')?.dataset.messageId;
      return resolveCriticalRoll(game.messages.get(messageId));
    }
    const actor = await resolveDocument(button.dataset.actorUuid);
    return rollDeathSave(actor, actor?.items?.get(button.dataset.injuryId));
  }
  finally { if (button.isConnected) button.disabled = false; }
}
