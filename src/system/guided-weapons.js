import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { resolveCombatActionSpend } from './combat-actions.js';
import { getSkillCombatType } from './combat-modifiers.js';
import { isActorInActiveCombat } from './reloading.js';
import { getActorActionSkill } from './action-skills.js';

const EVADABLE_MODES = new Set(['airSeeking', 'underwaterSeeking']);

async function resolveUuid(uuid) {
  if (!uuid) return null;
  try {
    // eslint-disable-next-line no-undef
    return await fromUuid(uuid);
  }
  catch (_error) {
    return null;
  }
}

function successCount(result) {
  const roll = result?.rolls?.[0] ?? result;
  return Number(roll?.baseSuccessQty) || 0;
}

async function updateRollMessage(message, roll) {
  await message.update({ content: await roll.render(), rolls: [JSON.stringify(roll)] });
}

export function isGuidedAttack(attackData = {}) {
  return Boolean(attackData.guidance && attackData.guidance.mode !== 'none');
}

export function guidedImpactCanApply(roll) {
  if (!isGuidedAttack(roll?.options?.attackData)) return true;
  return roll.options.guidedImpact?.status === 'ready';
}

export function guidedImpactCanSchedule(roll) {
  return isGuidedAttack(roll?.options?.attackData) && !roll.options.guidedImpact;
}

export function guidedImpactIsPending(roll) {
  return roll?.options?.guidedImpact?.status === 'pending';
}

export function guidedImpactWasEvaded(roll) {
  return roll?.options?.guidedImpact?.status === 'evaded';
}

export function guidedImpactCanEvade(roll) {
  const impact = roll?.options?.guidedImpact;
  const mode = roll?.options?.attackData?.guidance?.mode;
  return impact?.status === 'pending' && EVADABLE_MODES.has(mode) && !impact.evasionAttempted;
}

export async function scheduleGuidedImpact(message) {
  const roll = message?.rolls?.[0];
  if (!roll || !guidedImpactCanSchedule(roll)) return false;
  const combat = game.combat;
  if (!combat?.started) {
    roll.options.guidedImpact = { status: 'ready', dueRound: 0, targetUuid: roll.options.attackData.primaryTargetUuid };
  }
  else {
    const delay = Math.max(1, Number(roll.options.attackData.guidance.delayRounds) || 1);
    roll.options.guidedImpact = {
      status: 'pending',
      dueRound: Number(combat.round) + delay,
      targetUuid: roll.options.attackData.primaryTargetUuid,
      evasionAttempted: false,
    };
  }
  await updateRollMessage(message, roll);
  return true;
}

function vehicleDriver(vehicle) {
  const occupants = vehicle.system.crew?.occupants ?? [];
  const driver = occupants.find(occupant => occupant.position === 'DRIVER') ?? occupants[0];
  return driver ? game.actors.get(driver.id) : null;
}

export async function evadeGuidedImpact(message) {
  const roll = message?.rolls?.[0];
  if (!roll || !guidedImpactCanEvade(roll)) return false;
  const targetDocument = await resolveUuid(roll.options.guidedImpact.targetUuid);
  const target = targetDocument?.actor ?? targetDocument;
  if (!target || target.type !== 'vehicle') return false;
  const driver = vehicleDriver(target);
  const skill = getActorActionSkill(driver, 'evadeGuidedWeapon', 'driving');
  if (!driver || !skill) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Guidance.Errors.NoDriver'));
    return false;
  }
  if (!game.user.isGM && !driver.isOwner) return false;
  const action = resolveCombatActionSpend({
    inCombat: isActorInActiveCombat(driver, game.combat),
    speed: 'slow',
    fast: driver.system.actions?.fast?.value,
    slow: driver.system.actions?.slow?.value,
  });
  if (!action.available) {
    ui.notifications.warn(game.i18n.localize('YZEGS.CombatActions.NoSlowAction'));
    return false;
  }
  if (action.tracked) {
    await driver.update({ [`system.actions.${action.spentFrom}.value`]: action.remaining[action.spentFrom] });
  }
  const modifier = Number(roll.options.attackData.guidance.evasionModifier) || -3;
  const result = await YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, driver),
    actor: driver,
    title: game.i18n.format('YZEGS.Guidance.Evasion.Title', { target: target.name }),
    combatType: getSkillCombatType(skill),
    modifier,
    hideCombatActions: true,
  });
  roll.options.guidedImpact.evasionAttempted = true;
  if (successCount(result) > 0) roll.options.guidedImpact.status = 'evaded';
  await updateRollMessage(message, roll);
  return true;
}

export async function advanceGuidedImpacts(combat, changes, userId) {
  if (!Object.hasOwn(changes, 'round') || userId !== game.user.id || !game.user.isGM) return false;
  const round = Number(combat.round) || 0;
  for (const message of game.messages ?? []) {
    const roll = message.rolls?.[0];
    const impact = roll?.options?.guidedImpact;
    if (impact?.status !== 'pending' || Number(impact.dueRound) > round) continue;
    impact.status = 'ready';
    await updateRollMessage(message, roll);
  }
  return true;
}
