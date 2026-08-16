import YZEGSDialog from '../components/dialog/dialog.js';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getSkillCombatType } from './combat-modifiers.js';
import { applyVehicleDamage } from './vehicle-damage.js';
import { enterDeepWater } from './water-environment.js';
import {
  advanceSinking,
  getCollisionDamage,
  getGroundingDamage,
  getLargeVesselTurnCost,
  getRammingDamage,
} from './water-rules.js';
import { getActorActionSkill } from './action-skills.js';

function activeResults(roll) {
  return roll.dice.flatMap(die => die.results.filter(result => result.active).map(result => result.result));
}

function escapeHTML(value) {
  const element = document.createElement('div');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

async function post(actor, title, detail, rolls = []) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls,
    content: `<div class="yzegs chat-card watercraft-card"><h3><i class="fas fa-ship"></i> ${
      escapeHTML(title)
    }</h3><p>${escapeHTML(detail)}</p></div>`,
  });
}

async function putCrewOverboard(vehicle) {
  for (const occupant of vehicle.system.crew?.occupants ?? []) {
    const actor = game.actors.get(occupant.id);
    if (!actor) continue;
    await enterDeepWater(actor, { cold: false });
    if (!actor.statuses?.has?.('overboard')) await actor.toggleStatusEffect('overboard', { active: true });
  }
}

function crewChoices(vehicle) {
  return Object.fromEntries((vehicle.system.crew?.occupants ?? [])
    .map(occupant => game.actors.get(occupant.id))
    .filter(actor => actor?.getSkill)
    .map(actor => [actor.uuid, actor.name]));
}

async function chooseCrew(vehicle, actionId, fallbackSkill, title) {
  const choices = crewChoices(vehicle);
  const uuids = Object.keys(choices);
  if (!uuids.length) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Watercraft.Errors.NoCrew'));
    return null;
  }
  if (uuids.length === 1) return fromUuid(uuids[0]);
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/crew-choice-dialog.hbs',
    { data: { choices, selected: uuids[0] } },
  );
  const selected = await YZEGSDialog._wait({
    title,
    content,
    actionLabel: game.i18n.localize('YZEGS.Watercraft.Roll'),
    processForm: form => ({ uuid: form.elements.namedItem('crewUuid')?.value ?? '' }),
  });
  if (selected.cancelled) return null;
  const actor = await fromUuid(selected.uuid);
  if (!getActorActionSkill(actor, actionId, fallbackSkill)) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Watercraft.Errors.SkillMissing'));
    return null;
  }
  return actor;
}

async function taskCheck(vehicle, actionId, fallbackSkill, title, modifier = 0) {
  const crew = await chooseCrew(vehicle, actionId, fallbackSkill, title);
  const skill = getActorActionSkill(crew, actionId, fallbackSkill);
  if (!crew || !skill) return null;
  return YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, crew), actor: crew, title,
    combatType: getSkillCombatType(skill), modifier, hideCombatActions: true,
  });
}

function successCount(result) {
  const roll = result?.rolls?.[0] ?? result;
  return Number(roll?.baseSuccessQty) || 0;
}

export async function resolveGrounding(vehicle, { landing = false } = {}) {
  if (!vehicle || !['watercraft', 'amphibious'].includes(vehicle.system.domain)) return false;
  let reductions = 0;
  if (landing) {
    const modifier = vehicle.system.watercraft.landingCraft ? 3 : 0;
    reductions = successCount(await taskCheck(
      vehicle,
      'landVessel',
      'driving',
      game.i18n.localize('YZEGS.Watercraft.Actions.Landing'),
      modifier,
    ));
  }
  const size = Math.max(1, Math.trunc(Number(vehicle.system.watercraft.size) || 1));
  const roll = await new Roll(`${size}d6`).evaluate();
  const damage = Math.max(0, getGroundingDamage(activeResults(roll)) - reductions);
  await vehicle.update({
    'system.watercraft.grounded': true,
    'system.watercraft.stuck': landing ? reductions < 1 : true,
  });
  if (damage) {
    await applyVehicleDamage(vehicle, damage, {
      damage: Number.POSITIVE_INFINITY,
      armorModifier: 0,
      vehicleFacing: 'front',
      forceHullBreachOnPenetration: true,
    });
  }
  await post(vehicle, game.i18n.localize('YZEGS.Watercraft.Actions.Grounding'), game.i18n.format(
    'YZEGS.Watercraft.Results.Grounding', { damage, reductions },
  ), [roll]);
  return true;
}

export async function advanceWatercraftSinking(vehicle, { automatic = false } = {}) {
  if (!vehicle?.system.watercraft?.sinking || vehicle.system.watercraft.grounded || vehicle.system.watercraft.sunk) {
    return false;
  }
  const breaches = Math.max(1, Number(vehicle.system.watercraft.hullBreaches) || 0);
  const roll = await new Roll(`${breaches}d6`).evaluate();
  const result = advanceSinking({
    size: vehicle.system.watercraft.size,
    progress: vehicle.system.watercraft.sinkingProgress,
    breaches,
    results: activeResults(roll),
  });
  await vehicle.update({
    'system.watercraft.sinkingProgress': result.progress,
    'system.watercraft.sunk': result.sunk,
    'system.watercraft.stopped': result.sunk || vehicle.system.watercraft.stopped,
  });
  if (result.sunk) await putCrewOverboard(vehicle);
  await post(vehicle, game.i18n.localize('YZEGS.Watercraft.Actions.SinkingCheck'), game.i18n.format(
    result.sunk ? 'YZEGS.Watercraft.Results.Sunk' : 'YZEGS.Watercraft.Results.Sinking',
    { progress: result.progress, size: vehicle.system.watercraft.size },
  ), [roll]);
  if (automatic && result.sunk) {
    ui.notifications.warn(game.i18n.format('YZEGS.Watercraft.Results.SunkNotice', {
      vessel: vehicle.name,
    }));
  }
  return result;
}

export async function repairWatercraftHull(vehicle) {
  const parts = vehicle.items.filter(item => item.type === 'gear'
    && ['hull', 'universal'].includes(item.system.sparePartType)
    && Number(item.system.qty) > 0);
  if (!parts.length) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Watercraft.Errors.HullPart'));
    return false;
  }
  const result = await taskCheck(
    vehicle,
    'repairHull',
    'tech',
    game.i18n.localize('YZEGS.Watercraft.Actions.RepairHull'),
  );
  if (!result || successCount(result) < 1) return false;
  const part = parts[0];
  await part.update({ 'system.qty': Math.max(0, Number(part.system.qty) - 1) });
  await vehicle.update({
    'system.watercraft.hullBreaches': 0,
    'system.watercraft.sinkingProgress': 0,
    'system.watercraft.sinking': false,
    'system.watercraft.sinkingDeadline': 0,
  });
  return true;
}

export async function completeWatercraftHullRepair(vehicle) {
  const parts = vehicle.items.filter(item => item.type === 'gear'
    && ['hull', 'universal'].includes(item.system.sparePartType)
    && Number(item.system.qty) > 0);
  if (!parts.length) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Watercraft.Errors.HullPart'));
    return false;
  }
  await parts[0].update({ 'system.qty': Math.max(0, Number(parts[0].system.qty) - 1) });
  await vehicle.update({
    'system.watercraft.hullBreaches': 0,
    'system.watercraft.sinkingProgress': 0,
    'system.watercraft.sinking': false,
    'system.watercraft.sinkingDeadline': 0,
  });
  return true;
}

export async function repairWatercraftComponent(vehicle) {
  const choices = {
    engine: game.i18n.localize('YZEGS.Watercraft.Components.engine'),
    propulsion: game.i18n.localize('YZEGS.SpareParts.Propulsion'),
    rigging: game.i18n.localize('YZEGS.Watercraft.Components.mastRigging'),
    radio: game.i18n.localize('YZEGS.Watercraft.Components.radio'),
    antenna: game.i18n.localize('YZEGS.Watercraft.Components.antenna'),
  };
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/component-repair-dialog.hbs',
    { data: { choices, selected: 'engine' } },
  );
  const selection = await YZEGSDialog._wait({
    title: game.i18n.localize('YZEGS.Watercraft.Actions.RepairComponent'),
    content,
    actionLabel: game.i18n.localize('YZEGS.Watercraft.Roll'),
    processForm: form => ({ component: form.elements.namedItem('component')?.value ?? 'engine' }),
  });
  if (selection.cancelled) return false;
  const partType = selection.component === 'rigging' ? 'rigging' : selection.component;
  const part = vehicle.items.find(item => item.type === 'gear'
    && [partType, 'universal'].includes(item.system.sparePartType)
    && Number(item.system.qty) > 0);
  if (!part) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Watercraft.Errors.ComponentPart'));
    return false;
  }
  const result = await taskCheck(
    vehicle,
    'repairComponent',
    'tech',
    game.i18n.localize('YZEGS.Watercraft.Actions.RepairComponent'),
  );
  if (!result || successCount(result) < 1) return false;
  let component = selection.component;
  if (component === 'rigging') component = 'mastRigging';
  else if (component === 'propulsion') component = 'engine';
  await part.update({ 'system.qty': Math.max(0, Number(part.system.qty) - 1) });
  await vehicle.update({
    [`system.components.${component}.damage`]: Math.max(
      0,
      Number(vehicle.system.components?.[component]?.damage) - successCount(result),
    ),
    ...(component === 'engine' ? { 'system.watercraft.stopped': false } : {}),
  });
  return true;
}

export async function freeWatercraft(vehicle) {
  const result = await taskCheck(
    vehicle,
    'freeVessel',
    'driving',
    game.i18n.localize('YZEGS.Watercraft.Actions.FreeVessel'),
  );
  if (!result || successCount(result) < 1) return false;
  const updates = { 'system.watercraft.grounded': false, 'system.watercraft.stuck': false };
  if (Number(vehicle.system.watercraft.hullBreaches) > 0) {
    updates['system.watercraft.sinking'] = true;
    updates['system.watercraft.sinkingDeadline'] = (Number(game.time?.worldTime) || 0) + 900;
  }
  await vehicle.update(updates);
  return true;
}

export async function bailWater(vehicle) {
  const result = await taskCheck(
    vehicle,
    'bailWater',
    'stamina',
    game.i18n.localize('YZEGS.Watercraft.Actions.BailWater'),
  );
  if (!result || successCount(result) < 1) return false;
  await vehicle.update({
    'system.watercraft.sinkingProgress': Math.max(0, Number(vehicle.system.watercraft.sinkingProgress) - 1),
    'system.watercraft.sinkingDeadline': (Number(game.time?.worldTime) || 0) + 900,
  });
  return true;
}

export async function resolveCollision(vehicle, { ramming = false } = {}) {
  const targeted = [...(game.user.targets ?? [])]
    .map(token => token.actor)
    .filter(actor => actor?.type === 'vehicle' && actor.uuid !== vehicle.uuid);
  const target = targeted.length === 1 ? targeted[0] : null;
  if (ramming && !target) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Watercraft.Errors.RamTarget'));
    return false;
  }
  if (target) {
    const targetSize = Math.max(1, Number(target.system.watercraft?.size) || 1);
    const vehicleSize = Math.max(1, Number(vehicle.system.watercraft?.size) || 1);
    let successes = 0;
    if (ramming) {
      successes = successCount(await taskCheck(
        vehicle,
        'ramVessel',
        'driving',
        game.i18n.localize('YZEGS.Watercraft.Actions.Ram'),
      ));
    }
    await applyVehicleDamage(vehicle, getCollisionDamage(targetSize), {
      damage: getCollisionDamage(targetSize), vehicleFacing: 'front',
    });
    const targetDamage = ramming
      ? getRammingDamage(vehicleSize, successes)
      : getCollisionDamage(vehicleSize);
    await applyVehicleDamage(target, targetDamage, { damage: targetDamage, vehicleFacing: 'front' });
    return true;
  }
  const content = `<div class="form-group"><label>${game.i18n.localize('YZEGS.Watercraft.OtherSize')}</label>
    <input type="number" name="size" min="1" step="1" value="1"></div>`;
  const selection = await YZEGSDialog._wait({
    title: game.i18n.localize(ramming ? 'YZEGS.Watercraft.Actions.Ram' : 'YZEGS.Watercraft.Actions.Collision'),
    content,
    actionLabel: game.i18n.localize('YZEGS.Watercraft.Resolve'),
    processForm: form => ({ size: Math.max(1, Number(form.elements.namedItem('size')?.value) || 1) }),
  });
  if (selection.cancelled) return false;
  const damage = getCollisionDamage(selection.size);
  await applyVehicleDamage(vehicle, damage, { damage, vehicleFacing: 'front' });
  return true;
}

export async function turnLargeVessel(vehicle) {
  const cost = getLargeVesselTurnCost(vehicle.system.watercraft?.size);
  await post(vehicle, game.i18n.localize('YZEGS.Watercraft.Actions.Turn'), game.i18n.format(
    'YZEGS.Watercraft.Results.Turn', { cost },
  ));
  return cost;
}

export async function applyRammingOutcome(vehicle, target, successes = 0) {
  if (!vehicle || !target) return false;
  const vehicleSize = Math.max(1, Number(vehicle.system.watercraft?.size) || 1);
  const targetSize = Math.max(1, Number(target.system.watercraft?.size) || 1);
  const selfDamage = getCollisionDamage(targetSize);
  const targetDamage = getRammingDamage(vehicleSize, successes);
  await applyVehicleDamage(vehicle, selfDamage, { damage: selfDamage, vehicleFacing: 'front' });
  await applyVehicleDamage(target, targetDamage, { damage: targetDamage, vehicleFacing: 'front' });
  return true;
}

export async function resolveCareening(vehicle) {
  const roll = await new Roll('1d6').evaluate();
  const direction = Number(activeResults(roll)[0]) || 1;
  const speed = Math.max(
    Number(vehicle.system.movement?.combat?.onRoad) || 0,
    Number(vehicle.system.movement?.combat?.offRoad) || 0,
  );
  await post(vehicle, game.i18n.localize('YZEGS.Watercraft.Actions.Careen'), game.i18n.format(
    'YZEGS.Watercraft.Results.Careen', { direction, speed },
  ), [roll]);
  return { direction, speed };
}

export async function resolveInternalExplosion(vehicle) {
  const content = `<div class="form-group"><label>${game.i18n.localize('YZEGS.ItemSheet.Damage')}</label>
    <input type="number" name="damage" min="1" step="1" value="2"></div>`;
  const selection = await YZEGSDialog._wait({
    title: game.i18n.localize('YZEGS.Watercraft.Actions.InternalExplosion'),
    content,
    actionLabel: game.i18n.localize('YZEGS.Watercraft.Resolve'),
    processForm: form => ({ damage: Math.max(1, Number(form.elements.namedItem('damage')?.value) || 1) }),
  });
  if (selection.cancelled) return false;
  await applyVehicleDamage(vehicle, selection.damage, {
    damage: selection.damage,
    vehicleFacing: 'front',
    forceHullBreachOnPenetration: true,
  });
  return true;
}

export async function runWatercraftSheetAction(vehicle, action) {
  switch (action) {
    case 'grounding': return resolveGrounding(vehicle);
    case 'landing': return resolveGrounding(vehicle, { landing: true });
    case 'sinking': return advanceWatercraftSinking(vehicle);
    case 'repairHull': return repairWatercraftHull(vehicle);
    case 'repairComponent': return repairWatercraftComponent(vehicle);
    case 'freeVessel': return freeWatercraft(vehicle);
    case 'bailWater': return bailWater(vehicle);
    case 'collision': return resolveCollision(vehicle);
    case 'ram': return resolveCollision(vehicle, { ramming: true });
    case 'turn': return turnLargeVessel(vehicle);
    case 'careen': return resolveCareening(vehicle);
    case 'internalExplosion': return resolveInternalExplosion(vehicle);
    default: return false;
  }
}

export async function advanceCombatWatercraft(combat, changes, userId) {
  if (!Object.hasOwn(changes, 'round') || userId !== game.user.id || !game.user.isGM) return false;
  const vessels = new Map();
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    if (actor?.type === 'vehicle' && actor.system.watercraft?.sinking) vessels.set(actor.uuid, actor);
  }
  for (const vessel of vessels.values()) await advanceWatercraftSinking(vessel, { automatic: true });
  return true;
}

export async function advanceWorldTimeWatercraft(worldTime, _delta, _options, userId) {
  if (userId !== game.user.id || !game.user.isGM) return false;
  for (const vessel of game.actors.filter(actor => (
    actor.type === 'vehicle'
    && actor.system.watercraft?.sinking
    && !actor.system.watercraft.grounded
    && !actor.system.watercraft.sunk
    && Number(actor.system.watercraft.sinkingDeadline) > 0
    && Number(actor.system.watercraft.sinkingDeadline) <= Number(worldTime)
  ))) {
    await vessel.update({
      'system.watercraft.sunk': true,
      'system.watercraft.stopped': true,
    });
    await putCrewOverboard(vessel);
    await post(vessel, game.i18n.localize('YZEGS.Watercraft.Actions.SinkingCheck'), game.i18n.format(
      'YZEGS.Watercraft.Results.SunkNotice', { vessel: vessel.name },
    ));
  }
  return true;
}

export { applyVehicleDamage };
