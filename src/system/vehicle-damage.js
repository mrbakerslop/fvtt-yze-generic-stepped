import Armor from '../components/armor.js';
import YZEGSDialog from '../components/dialog/dialog.js';
import { getWatercraftComponent } from './water-rules.js';
import { YZEGSRoller } from '../components/roll/dice.js';
import { applySuppressionFailure } from './suppression-workflows.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

function escapeHTML(value) {
  const element = document.createElement('div');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function activeResults(roll) {
  return roll.dice.flatMap(die => die.results.filter(result => result.active).map(result => result.result));
}

function componentUpdate(actor, component, penetrated, damage, forceHullBreach = false) {
  const updates = {};
  const componentPath = {
    hull: 'hull', engine: 'engine', fuel: 'fuel', ammunition: 'ammunition',
    radio: 'radio', weapon: '', fcs: 'fcs', antenna: 'antenna',
    mastRigging: 'mastRigging',
  }[component];
  if (componentPath) {
    const current = Number(actor.system.components?.[componentPath]?.damage) || 0;
    updates[`system.components.${componentPath}.damage`] = current + Math.max(1, damage);
  }
  if (component === 'engine') updates['system.watercraft.stopped'] = true;
  if (component === 'mastRigging') {
    updates['system.reliability.value'] = Math.max(0, Number(actor.system.reliability?.value) - 1);
  }
  if (component === 'hull' && penetrated && ['watercraft', 'amphibious'].includes(actor.system.domain)) {
    updates['system.watercraft.hullBreaches'] = Math.max(
      0,
      Number(actor.system.watercraft?.hullBreaches) || 0,
    ) + 1;
    updates['system.watercraft.sinking'] = true;
    if (!actor.system.watercraft?.sinkingDeadline) {
      updates['system.watercraft.sinkingDeadline'] = (Number(game.time?.worldTime) || 0) + 900;
    }
  }
  if (penetrated && damage > 0 && actor.system.domain !== 'land' && forceHullBreach) {
    updates['system.watercraft.hullBreaches'] = Math.max(
      Number(updates['system.watercraft.hullBreaches']) || 0,
      Math.max(0, Number(actor.system.watercraft?.hullBreaches) || 0) + 1,
    );
    updates['system.watercraft.sinking'] = true;
    if (!actor.system.watercraft?.sinkingDeadline) {
      updates['system.watercraft.sinkingDeadline'] = (Number(game.time?.worldTime) || 0) + 900;
    }
  }
  return updates;
}

async function resolveCrewShock(vehicle) {
  for (const occupant of vehicle.system.crew?.occupants ?? []) {
    const actor = game.actors.get(occupant.id);
    if (!actor || !['character', 'npc'].includes(actor.type)) continue;
    const result = await YZEGSRoller.cufCheck({
      actor,
      title: game.i18n.format('YZEGS.Watercraft.Damage.CrewShock', { actor: actor.name }),
      messageMode: 'public',
    });
    const roll = result?.rolls?.[0] ?? result;
    if (result && Number(roll?.baseSuccessQty) < 1) await applySuppressionFailure(actor);
  }
}

async function chooseFacing(actor, damage, initial = 'front') {
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/vehicle-damage-dialog.hbs',
    {
      data: {
        target: actor.name,
        damage,
        facing: initial,
        facingChoices: {
          front: game.i18n.localize('YZEGS.VehicleSheet.FrontArmor'),
          left: game.i18n.localize('YZEGS.VehicleSheet.SideLeftArmor'),
          right: game.i18n.localize('YZEGS.VehicleSheet.SideRightArmor'),
          rear: game.i18n.localize('YZEGS.VehicleSheet.RearArmor'),
        },
      },
    },
  );
  return YZEGSDialog._wait({
    title: game.i18n.localize('YZEGS.Watercraft.Damage.Title'),
    content,
    actionLabel: game.i18n.localize('YZEGS.Watercraft.Damage.Apply'),
    processForm: form => ({ facing: form.elements.namedItem('facing')?.value ?? 'front' }),
  });
}

/** Resolve armor and a component hit for any Vehicle Actor. */
export async function applyVehicleDamage(actor, amount = 0, attackData = {}, sendMessage = true) {
  if (actor?.type !== 'vehicle') return 0;
  const initialAmount = Math.max(0, Number(amount) || 0);
  if (!initialAmount) return 0;
  let facing = attackData.vehicleFacing;
  if (!['front', 'left', 'right', 'rear'].includes(facing)) {
    const selection = await chooseFacing(actor, initialAmount);
    if (selection.cancelled) return 0;
    facing = selection.facing;
  }
  const armorRating = Number(actor.system.armor?.[facing]?.value) || 0;
  const armor = new Armor(armorRating, game.i18n.localize('YZEGS.VehicleSheet.Armor'));
  let applied = initialAmount;
  if (!attackData.ignoreVehicleArmor) {
    applied = await armor.penetration(
      initialAmount,
      Number(attackData.damage) || initialAmount,
      Number(attackData.armorModifier) || 0,
    );
  }
  const penetrated = applied > 0;
  const componentRoll = await new Roll('1d10').evaluate();
  const component = getWatercraftComponent(activeResults(componentRoll)[0], penetrated);
  const updates = componentUpdate(
    actor,
    component,
    penetrated,
    applied,
    Boolean(attackData.forceHullBreachOnPenetration),
  );
  if (armor.damaged) {
    updates[`system.armor.${facing}.value`] = Math.max(0, armor.value);
  }
  if (!foundry.utils.isEmpty(updates)) await actor.update(updates);
  if (penetrated && ['watercraft', 'amphibious'].includes(actor.system.domain)) await resolveCrewShock(actor);

  if (sendMessage) {
    const componentName = game.i18n.localize(`YZEGS.Watercraft.Components.${component}`);
    const result = penetrated
      ? game.i18n.format('YZEGS.Watercraft.Damage.Penetrated', { damage: applied, component: componentName })
      : game.i18n.format('YZEGS.Watercraft.Damage.Stopped', { component: componentName });
    const occupantBlast = penetrated && attackData.waterMine && ['A', 'B', 'C', 'D'].includes(attackData.blast)
      ? `<p><strong>${escapeHTML(game.i18n.localize('YZEGS.Watercraft.Damage.OccupantBlast'))}</strong></p>`
      : '';
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [componentRoll],
      content: `<div class="yzegs chat-card vehicle-damage-card"><h3><i class="fas fa-ship"></i> ${
        escapeHTML(game.i18n.localize('YZEGS.Watercraft.Damage.Title'))
      }</h3><p>${escapeHTML(actor.name)} — ${escapeHTML(result)}</p>${occupantBlast}</div>`,
      flags: { [SYSTEM_ID]: { vehicleDamage: { facing, initialAmount, applied, component, penetrated } } },
    });
  }
  return -applied;
}
