import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getSkillCombatType } from './combat-modifiers.js';
import { enterDeepWater } from './water-environment.js';
import { getWaterMishap, getWaterTravelProfile } from './water-rules.js';
import { resolveGrounding } from './watercraft-workflows.js';
import { getActionSkillName, getActorActionSkill } from './action-skills.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

function escapeHTML(value) {
  const element = document.createElement('div');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function activeResults(roll) {
  return roll.dice.flatMap(die => die.results.filter(result => result.active).map(result => result.result));
}

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

function firstAssignedActor(party, action) {
  const value = party.system.travel?.[action];
  const actorId = Array.isArray(value) ? value[0] : value;
  return actorId ? game.actors.get(actorId) : null;
}

async function applyMishap(vessel, mishap) {
  const updates = {};
  switch (mishap) {
    case 'engineBlown':
      updates['system.components.engine.damage'] = Number(vessel.system.components.engine.damage) + 1;
      updates['system.watercraft.stopped'] = true;
      break;
    case 'mastBroken':
    case 'riggingDamaged':
      updates['system.components.mastRigging.damage'] = Number(vessel.system.components.mastRigging.damage) + 1;
      updates['system.reliability.value'] = Math.max(0, Number(vessel.system.reliability.value) - 1);
      if (mishap === 'mastBroken') updates['system.watercraft.stopped'] = true;
      break;
    case 'propulsionDamaged':
      updates['system.components.engine.damage'] = Number(vessel.system.components.engine.damage) + 1;
      updates['system.watercraft.stopped'] = true;
      break;
    case 'minorLeak':
      updates['system.reliability.value'] = Math.max(0, Number(vessel.system.reliability.value) - 1);
      updates['system.watercraft.hullBreaches'] = Number(vessel.system.watercraft.hullBreaches) + 1;
      updates['system.watercraft.sinking'] = true;
      updates['system.watercraft.sinkingDeadline'] = (Number(game.time?.worldTime) || 0) + 900;
      break;
    case 'majorLeak':
      updates['system.watercraft.hullBreaches'] = Number(vessel.system.watercraft.hullBreaches) + 1;
      updates['system.watercraft.sinking'] = true;
      updates['system.watercraft.sinkingDeadline'] = (Number(game.time?.worldTime) || 0) + 900;
      break;
    case 'forcedStop': updates['system.watercraft.stopped'] = true; break;
    case 'lost': await vessel.setFlag(SYSTEM_ID, 'waterTravelLost', true); break;
    case 'debrisCollision':
      await vessel.applyDamage(Number(vessel.system.watercraft.size) || 1, {
        damage: Number(vessel.system.watercraft.size) || 1, vehicleFacing: 'front', armorModifier: 0,
      }, true);
      break;
    case 'grounding': await resolveGrounding(vessel); break;
    case 'largeWave': {
      const occupants = vessel.system.crew?.occupants ?? [];
      if (occupants.length) {
        const roll = await new Roll(`1d${occupants.length}`).evaluate();
        const index = Math.max(0, Number(activeResults(roll)[0]) - 1);
        const actor = game.actors.get(occupants[index]?.id);
        if (actor) {
          await enterDeepWater(actor, { cold: false });
          if (!actor.statuses?.has?.('overboard')) await actor.toggleStatusEffect('overboard', { active: true });
        }
      }
      break;
    }
  }
  if (!foundry.utils.isEmpty(updates)) await vessel.update(updates);
}

export async function advanceWaterTravelShift(party, options = {}) {
  const vesselDocument = await resolveUuid(options.vesselUuid);
  const vessel = vesselDocument?.actor ?? vesselDocument;
  if (vessel?.type !== 'vehicle' || !['watercraft', 'amphibious'].includes(vessel.system.domain)) {
    ui.notifications.warn(game.i18n.localize('YZEGS.WaterTravel.Errors.Vessel'));
    return false;
  }
  const driver = firstAssignedActor(party, 'drive');
  const skill = getActorActionSkill(driver, 'waterTravelDriving', 'driving');
  if (!driver || !skill) {
    ui.notifications.warn(game.i18n.format('YZEGS.WaterTravel.Errors.Driver', {
      skill: getActionSkillName('waterTravelDriving', 'driving'),
    }));
    return false;
  }
  const profile = getWaterTravelProfile(options.terrain, { night: options.night });
  if (options.routeBranch) {
    const navigatorDocument = await resolveUuid(options.navigatorUuid);
    const navigatorActor = navigatorDocument?.actor ?? navigatorDocument;
    const navigationSkill = getActorActionSkill(navigatorActor, 'waterTravelNavigation', 'survival');
    if (!navigatorActor || !navigationSkill) {
      ui.notifications.warn(game.i18n.format('YZEGS.WaterTravel.Errors.Navigator', {
        skill: getActionSkillName('waterTravelNavigation', 'survival'),
      }));
      return false;
    }
    const navigation = await YZEGSRoller.taskCheck({
      ...getAttributeAndSkill(navigationSkill, navigatorActor),
      actor: navigatorActor,
      title: game.i18n.localize('YZEGS.WaterTravel.NavigationCheck'),
      combatType: getSkillCombatType(navigationSkill),
      hideCombatActions: true,
    });
    const navigationRoll = navigation?.rolls?.[0] ?? navigation;
    if ((Number(navigationRoll?.baseSuccessQty) || 0) < 1) {
      await vessel.setFlag(SYSTEM_ID, 'waterTravelLost', true);
    }
  }
  const result = await YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, driver),
    actor: driver,
    title: game.i18n.format('YZEGS.WaterTravel.DrivingCheck', { vessel: vessel.name }),
    combatType: getSkillCombatType(skill),
    modifier: profile.drivingModifier,
    hideCombatActions: true,
  });
  const taskRoll = result?.rolls?.[0] ?? result;
  const success = Number(taskRoll?.baseSuccessQty) > 0;
  let mishap = '';
  let mishapRoll = null;
  if (!success) {
    mishapRoll = await new Roll('2d6').evaluate();
    mishap = getWaterMishap(mishapRoll.total, vessel.system.watercraft.propulsion, options.terrain);
    await applyMishap(vessel, mishap);
  }
  const content = `<div class="yzegs chat-card water-travel-card"><h3><i class="fas fa-compass"></i> ${
    escapeHTML(game.i18n.localize('YZEGS.WaterTravel.Title'))
  }</h3><p>${escapeHTML(game.i18n.format('YZEGS.WaterTravel.Summary', {
    vessel: vessel.name,
    speed: profile.speed,
    distance: profile.encounterMultiplier,
  }))}</p>${mishap ? `<p><strong>${escapeHTML(game.i18n.localize('YZEGS.WaterTravel.Mishap'))}:</strong> ${
    escapeHTML(game.i18n.localize(`YZEGS.WaterTravel.Mishaps.${mishap}`))
  }</p>` : ''}</div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: party }),
    rolls: mishapRoll ? [mishapRoll] : [],
    content,
  });
  return { success, mishap, profile };
}

export async function rollWaterFishing(party, terrain = 'river') {
  const fisher = firstAssignedActor(party, 'fish');
  const skill = getActorActionSkill(fisher, 'waterTravelFishing', 'survival');
  if (!fisher || !skill) {
    ui.notifications.warn(game.i18n.format('YZEGS.WaterTravel.Errors.Fisher', {
      skill: getActionSkillName('waterTravelFishing', 'survival'),
    }));
    return false;
  }
  const profile = getWaterTravelProfile(terrain);
  return YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, fisher),
    actor: fisher,
    title: game.i18n.localize('YZEGS.WaterTravel.FishingCheck'),
    combatType: getSkillCombatType(skill),
    modifier: profile.fishingModifier,
    hideCombatActions: true,
  });
}
