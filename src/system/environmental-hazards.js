import { applyFireCriticalInjury, killActor } from './critical-injuries.js';
import { YZEGSRoller, getAttributeAndSkill } from '../components/roll/dice.js';
import { getActorActionSkill } from './action-skills.js';
import { exposeActorToDisease } from './disease-workflows.js';
import {
  fireDieFaces,
  increaseFireIntensity,
  steppedDieSuccesses,
} from './disease-rules.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';
const DAY = 86400;
const CONDITION_INTERVALS = Object.freeze({ starving: 7 * DAY, dehydrated: DAY, sleepless: DAY });

function primaryActiveGM() {
  return game.users.find(user => user.active && user.isGM) ?? null;
}

async function postHazardMessage(actor, title, body, icon = 'fa-triangle-exclamation') {
  const content = `<section class="yzegs chat-card hazard-card"><h3><i class="fa-solid ${icon}"></i>
    ${foundry.utils.escapeHTML(title)}</h3><p><strong>${foundry.utils.escapeHTML(actor.name)}</strong>
    — ${body}</p></section>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

export async function applyEnvironmentalHarm(actor, { damage = 0, stress = 0, reason = '' } = {}) {
  if (!['character', 'npc'].includes(actor?.type)) return null;
  damage = Math.max(0, Number(damage) || 0);
  stress = Math.max(0, Number(stress) || 0);
  const health = Math.max(0, Number(actor.system.health.value) - damage);
  const sanity = Math.max(0, Number(actor.system.sanity.value) - stress);
  const update = {};
  if (damage) update['system.health.value'] = health;
  if (stress) update['system.sanity.value'] = sanity;
  if (Object.keys(update).length) await actor.update(update);
  await postHazardMessage(
    actor,
    reason || game.i18n.localize('YZEGS.Hazards.EnvironmentalHarm'),
    game.i18n.format('YZEGS.Hazards.HarmApplied', { damage, stress }));
  return { damage, stress, health, sanity };
}

export async function resolveFireAttack(actor, intensity = 'C', { ongoing = false } = {}) {
  if (!['character', 'npc'].includes(actor?.type)) return null;
  const normalized = ['A', 'B', 'C', 'D'].includes(String(intensity).toLocaleUpperCase())
    ? String(intensity).toLocaleUpperCase() : 'C';
  const faces = fireDieFaces(normalized);
  const roll = await new Roll(`2d${faces}`).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game.i18n.format('YZEGS.Hazards.FireAttack', { actor: actor.name, intensity: normalized }),
  });
  const damage = roll.dice.flatMap(die => die.results)
    .filter(result => result.active !== false)
    .reduce((sum, result) => sum + steppedDieSuccesses(result.result, faces), 0);
  if (!damage) {
    if (ongoing) {
      await actor.toggleStatusEffect('fire', { active: false });
      await actor.unsetFlag(SYSTEM_ID, 'fireHazard');
      await postHazardMessage(actor, game.i18n.localize('YZEGS.Hazards.Fire'),
        game.i18n.localize('YZEGS.Hazards.FireWentOut'), 'fa-fire-extinguisher');
    }
    return { damage: 0, extinguished: ongoing };
  }
  await applyEnvironmentalHarm(actor, { damage, reason: game.i18n.localize('YZEGS.Hazards.Fire') });
  await actor.toggleStatusEffect('fire', { active: true });
  await actor.setFlag(SYSTEM_ID, 'fireHazard', {
    intensity: ongoing ? increaseFireIntensity(normalized) : normalized,
  });
  if (damage >= 2) {
    try {
      await applyFireCriticalInjury(actor, { damage });
    }
    catch (error) {
      console.error('yzegs | Failed to apply the fire critical injury.', error);
    }
  }
  return { damage, extinguished: false };
}

export async function advanceCombatFire(combat, changes, userId) {
  if (userId !== game.user.id || primaryActiveGM()?.id !== game.user.id) return;
  if (!Object.hasOwn(changes, 'turn') && !Object.hasOwn(changes, 'round')) return;
  const actor = combat.combatant?.actor;
  const state = actor?.getFlag(SYSTEM_ID, 'fireHazard');
  if (!actor?.statuses?.has?.('fire') || !state) return;
  await resolveFireAttack(actor, state.intensity, { ongoing: true });
}

export async function clearActorFire(actor) {
  if (!actor) return;
  await actor.toggleStatusEffect('fire', { active: false });
  await actor.unsetFlag(SYSTEM_ID, 'fireHazard');
}

export async function synchronizeConditionTimers(actor, changes = {}) {
  if (!['character', 'npc'].includes(actor?.type)) return;
  const conditionChanges = foundry.utils.getProperty(changes, 'system.conditions');
  if (!conditionChanges) return;
  const timers = foundry.utils.deepClone(actor.getFlag(SYSTEM_ID, 'conditionTimers') ?? {});
  const now = Number(game.time.worldTime) || 0;
  let changed = false;
  for (const [condition, enabled] of Object.entries(conditionChanges)) {
    if (enabled && !timers[condition]) {
      timers[condition] = { since: now, lastHarm: now };
      changed = true;
    }
    else if (!enabled && timers[condition]) {
      delete timers[condition];
      changed = true;
    }
  }
  if (changed) await actor.setFlag(SYSTEM_ID, 'conditionTimers', timers);
}

export async function advanceEnvironmentalWorldTime(_worldTime, _delta, _options, userId) {
  if (userId !== game.user.id || primaryActiveGM()?.id !== game.user.id) return;
  const now = Number(game.time.worldTime) || 0;
  for (const actor of game.actors.filter(entry => ['character', 'npc'].includes(entry.type))) {
    const timers = foundry.utils.deepClone(actor.getFlag(SYSTEM_ID, 'conditionTimers') ?? {});
    let changed = false;
    for (const [condition, interval] of Object.entries(CONDITION_INTERVALS)) {
      if (!actor.system.conditions?.[condition]) continue;
      const timer = timers[condition] ?? { since: now, lastHarm: now };
      if (
        condition !== 'sleepless'
        && Number(actor.system.health.value) <= 0
        && timer.incapacitatedAt
        && now >= Number(timer.incapacitatedAt) + interval
      ) {
        await killActor(actor, { reason: game.i18n.localize(`YZEGS.ConditionNames.${condition}`) });
        continue;
      }
      const elapsed = Math.max(0, now - Number(timer.lastHarm || now));
      const ticks = Math.floor(elapsed / interval);
      if (!ticks) {
        if (!timers[condition]) {
          timers[condition] = timer;
          changed = true;
        }
        continue;
      }
      if (condition === 'sleepless') {
        await applyEnvironmentalHarm(actor, {
          stress: ticks,
          reason: game.i18n.localize('YZEGS.ConditionNames.sleepless'),
        });
        if (Number(actor.system.sanity.value) <= ticks) await actor.toggleStatusEffect('sleep', { active: true });
      }
      else {
        const result = await applyEnvironmentalHarm(actor, {
          damage: ticks,
          reason: game.i18n.localize(`YZEGS.ConditionNames.${condition}`),
        });
        if (result.health <= 0 && !timer.incapacitatedAt) timer.incapacitatedAt = now;
      }
      timer.lastHarm = Number(timer.lastHarm || now) + ticks * interval;
      timers[condition] = timer;
      changed = true;
    }
    if (changed) await actor.setFlag(SYSTEM_ID, 'conditionTimers', timers);

    if (actor.type === 'character' && Number(actor.system.rads?.temporary) > 0) {
      const lastDecay = Number(actor.getFlag(SYSTEM_ID, 'radiationDecayAt')) || now;
      const lost = Math.floor(Math.max(0, now - lastDecay) / DAY);
      if (lost > 0) {
        await actor.update({
          'system.rads.temporary': Math.max(0, Number(actor.system.rads.temporary) - lost),
        });
        await actor.setFlag(SYSTEM_ID, 'radiationDecayAt', lastDecay + lost * DAY);
      }
      else if (!actor.getFlag(SYSTEM_ID, 'radiationDecayAt')) {
        await actor.setFlag(SYSTEM_ID, 'radiationDecayAt', now);
      }
    }
  }
}

export async function applyHazardRegion(actor, behavior) {
  if (!actor || !['character', 'npc'].includes(actor.type)) return;
  switch (behavior.hazardType) {
    case 'fire': return resolveFireAttack(actor, behavior.intensity);
    case 'disease': {
      const source = behavior.sourceUuid ? await fromUuid(behavior.sourceUuid) : null;
      if (source?.type !== 'disease') {
        ui.notifications.warn(game.i18n.localize('YZEGS.Hazards.InvalidDiseaseSource'));
        return null;
      }
      return exposeActorToDisease(actor, source);
    }
    case 'radiation': {
      if (actor.type !== 'character') return null;
      const amount = Math.max(1, Number(behavior.radiation) || 1);
      await actor.update({ 'system.rads.temporary': Number(actor.system.rads.temporary) + amount });
      const roll = await actor.rollRadiationAttack({
        askForOptions: true,
        maxPush: 0,
        lockMaxPush: true,
        sendMessage: false,
      });
      if (roll) {
        await roll.toMessage();
        if ((Number(roll.successCount) || 0) < 1 && behavior.sourceUuid) {
          const source = await fromUuid(behavior.sourceUuid);
          if (source?.type === 'disease') await exposeActorToDisease(actor, source);
        }
      }
      return amount;
    }
    case 'cold':
      await actor.update({ 'system.conditions.hypothermic': true });
      await actor.toggleStatusEffect('hypothermia', { active: true });
      return true;
  }
  return null;
}

export async function resolveHypothermiaCheck(actor) {
  if (!actor?.system.conditions?.hypothermic) return null;
  const skill = getActorActionSkill(actor, 'coldWaterCheck', 'stamina');
  if (!skill) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Disease.MissingSkill'));
    return null;
  }
  const roll = await YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, actor),
    title: game.i18n.format('YZEGS.Hazards.HypothermiaCheck', { actor: actor.name }),
    actor,
    maxPush: 0,
    lockMaxPush: true,
    hideCombatActions: true,
    sendMessage: false,
  });
  if (!roll) return null;
  await roll.toMessage();
  if ((Number(roll.successCount) || 0) > 0) return { success: true };
  if (Number(actor.system.health.value) <= 0) {
    await killActor(actor, { reason: game.i18n.localize('YZEGS.ConditionNames.hypothermic') });
    return { success: false, dead: true };
  }
  await applyEnvironmentalHarm(actor, {
    damage: 1,
    stress: 1,
    reason: game.i18n.localize('YZEGS.ConditionNames.hypothermic'),
  });
  return { success: false, dead: false };
}
