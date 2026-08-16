import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getActorActionSkill } from './action-skills.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export function hasWaterStatus(actor, statusId) {
  return actor?.statuses?.has?.(statusId) ?? false;
}

export function isSwimming(actor) {
  return hasWaterStatus(actor, 'swimming') || hasWaterStatus(actor, 'submerged');
}

export async function enterDeepWater(actor, { cold = false } = {}) {
  if (!['character', 'npc'].includes(actor?.type)) return false;
  if (hasWaterStatus(actor, 'prone')) await actor.toggleStatusEffect('prone', { active: false });
  await actor.toggleStatusEffect('swimming', { active: true });
  await actor.setFlag(SYSTEM_ID, 'waterExposure', { cold: Boolean(cold) });
  if (cold) await resolveColdWaterCheck(actor);
  return true;
}

export async function leaveDeepWater(actor) {
  if (!actor) return false;
  for (const statusId of ['swimming', 'submerged', 'drowning', 'overboard']) {
    if (hasWaterStatus(actor, statusId)) await actor.toggleStatusEffect(statusId, { active: false });
  }
  await actor.unsetFlag(SYSTEM_ID, 'waterExposure');
  return true;
}

export async function submergeActor(actor) {
  if (!actor || !isSwimming(actor)) return false;
  if (!hasWaterStatus(actor, 'submerged')) await actor.toggleStatusEffect('submerged', { active: true });
  return true;
}

export async function surfaceActor(actor) {
  if (!actor) return false;
  if (hasWaterStatus(actor, 'submerged')) await actor.toggleStatusEffect('submerged', { active: false });
  if (hasWaterStatus(actor, 'drowning')) await actor.toggleStatusEffect('drowning', { active: false });
  if (!hasWaterStatus(actor, 'swimming')) await actor.toggleStatusEffect('swimming', { active: true });
  return true;
}

export async function rescueDrowningActor(actor) {
  if (!actor) return false;
  await surfaceActor(actor);
  return true;
}

async function rollStamina(actor, title, modifier = 0) {
  const skill = getActorActionSkill(actor, 'coldWaterCheck', 'stamina');
  if (!skill) return null;
  return YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, actor),
    title,
    actor,
    maxPush: 0,
    skipDialog: true,
    hideCombatActions: true,
    modifier,
  });
}

function successCount(result) {
  const roll = result?.rolls?.[0] ?? result;
  return Number(roll?.baseSuccessQty) || 0;
}

export async function resolveColdWaterCheck(actor, modifier = 0) {
  const protection = [...(actor.items ?? [])].filter(item => item.type === 'gear' && item.system.equipped);
  if (protection.some(item => item.system.waterProtection === 'drySuit')) return true;
  modifier += protection
    .filter(item => item.system.waterProtection === 'wetsuit')
    .reduce((total, item) => total + (Number(item.system.coldWaterModifier) || 0), 0);
  const result = await rollStamina(
    actor,
    game.i18n.format('YZEGS.Water.Cold.Check', { actor: actor.name }),
    modifier,
  );
  if (!result) return false;
  if (modifier) {
    // The modifier is kept as an explicit reminder if an equipment-specific
    // test was launched without a dialog.
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${game.i18n.format('YZEGS.Water.Cold.ModifierReminder', { modifier })}</p>`,
    });
  }
  if (successCount(result) < 1 && !hasWaterStatus(actor, 'hypothermia')) {
    await actor.toggleStatusEffect('hypothermia', { active: true });
  }
  return successCount(result) > 0;
}

export async function advanceCombatWaterHazards(combat, changes, userId) {
  if (!Object.hasOwn(changes, 'round') || userId !== game.user.id || !game.user.isGM) return false;
  const actors = new Map();
  for (const combatant of combat.combatants ?? []) {
    if (combatant.actor?.uuid) actors.set(combatant.actor.uuid, combatant.actor);
  }
  for (const actor of actors.values()) {
    if (hasWaterStatus(actor, 'drowning')) {
      if (Number(actor.system.health?.value) <= 0) {
        const deathSave = await rollStamina(actor, game.i18n.format('YZEGS.Water.Drowning.DeathSave', {
          actor: actor.name,
        }));
        if (deathSave && successCount(deathSave) < 1 && !hasWaterStatus(actor, 'dead')) {
          await actor.toggleStatusEffect('dead', { active: true });
        }
        continue;
      }
      await actor.applyDamage(1, {
        damage: 1, crit: 0, blast: '–', armorModifier: 99, location: 'torso', barriers: [],
      }, true);
      continue;
    }
    if (!hasWaterStatus(actor, 'submerged')) continue;
    const result = await rollStamina(actor, game.i18n.format('YZEGS.Water.Drowning.HoldBreath', {
      actor: actor.name,
    }));
    if (result && successCount(result) < 1) await actor.toggleStatusEffect('drowning', { active: true });
  }
  return true;
}
