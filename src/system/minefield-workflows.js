import YZEGSDialog from '../components/dialog/dialog.js';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { resolveBlastTargets } from './blast-workflows.js';
import { isConfinedSpaceScene } from './confined-space.js';
import { resolveStandaloneCollapse } from './confined-space-workflows.js';
import {
  getMinefieldDetectionModifier,
  getMinefieldExposureCount,
  getMinefieldTriggerDie,
  minefieldAffectsActor,
  resolveMinefieldTriggers,
} from './minefield-rules.js';
import { canWaterMineAffectVessel } from './water-rules.js';
import { getActorActionSkill } from './action-skills.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ''));
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

function scoutChoices(movingActor) {
  const actors = new Map();
  for (const token of canvas.tokens?.placeables ?? []) {
    if (['character', 'npc'].includes(token.actor?.type)) actors.set(token.actor.uuid, token.actor);
  }
  if (['character', 'npc'].includes(movingActor?.type)) actors.set(movingActor.uuid, movingActor);
  return Object.fromEntries([...actors.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(actor => [actor.uuid, actor.name]));
}

async function chooseMinefieldMovement(typeData, actor) {
  const choices = scoutChoices(actor);
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/minefield-dialog.hbs',
    {
      data: {
        actorName: actor.name,
        regionName: typeData.region?.name ?? game.i18n.localize('YZEGS.Minefield.Region.Label'),
        mode: typeData.discovered ? 'cautious' : 'unaware',
        modeChoices: {
          unaware: game.i18n.localize('YZEGS.Minefield.Movement.Unaware'),
          cautious: game.i18n.localize('YZEGS.Minefield.Movement.Cautious'),
          probing: game.i18n.localize('YZEGS.Minefield.Movement.Probing'),
        },
        scoutUuid: choices[actor.uuid] ? actor.uuid : Object.keys(choices)[0] ?? '',
        scoutChoices: { '': game.i18n.localize('YZEGS.Minefield.Dialog.NoScout'), ...choices },
      },
    },
  );
  return YZEGSDialog._wait({
    title: game.i18n.localize('YZEGS.Minefield.Dialog.Title'),
    content,
    actionLabel: game.i18n.localize('YZEGS.Minefield.Dialog.Resolve'),
    processForm: form => ({
      mode: form.elements.namedItem('mode')?.value ?? 'unaware',
      scoutUuid: form.elements.namedItem('scoutUuid')?.value ?? '',
      hexes: Math.max(1, Math.trunc(Number(form.elements.namedItem('hexes')?.value) || 1)),
      entrants: Math.max(1, Math.trunc(Number(form.elements.namedItem('entrants')?.value) || 1)),
    }),
  });
}

async function attemptDetection(typeData, selection, movingActor) {
  if (typeData.discovered || !selection.scoutUuid) return false;
  const scoutDocument = await resolveUuid(selection.scoutUuid);
  const scout = scoutDocument?.actor ?? scoutDocument;
  const skill = getActorActionSkill(scout, 'detectMines', 'recon');
  if (!scout || !skill) return false;
  const stats = getAttributeAndSkill(skill, scout);
  const result = await YZEGSRoller.taskCheck({
    ...stats,
    title: game.i18n.format('YZEGS.Minefield.Detection.Title', { actor: scout.name }),
    actor: scout,
    modifier: getMinefieldDetectionModifier({
      mineType: typeData.mineType,
      condition: typeData.condition,
      mode: selection.mode,
      fromVehicle: movingActor.type === 'vehicle',
      modifier: typeData.detectionModifier,
    }),
    maxPush: 0,
    messageMode: 'gmroll',
    skipDialog: true,
    hideCombatActions: true,
  });
  const detected = Number(result?.rolls?.[0]?.baseSuccessQty) > 0;
  if (detected) await typeData.behavior.update({ 'system.discovered': true });
  return detected;
}

async function attemptWaterMineAvoidance(typeData, movingActor) {
  if (!typeData.discovered) return false;
  const occupants = movingActor.system.crew?.occupants ?? [];
  const driverEntry = occupants.find(occupant => occupant.position === 'DRIVER') ?? occupants[0];
  const driver = driverEntry ? game.actors.get(driverEntry.id) : null;
  const skill = getActorActionSkill(driver, 'waterMineAvoidance', 'driving');
  if (!driver || !skill) return false;
  const result = await YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, driver),
    actor: driver,
    title: game.i18n.format('YZEGS.Minefield.WaterAvoidance.Title', { actor: movingActor.name }),
    maxPush: 0,
    skipDialog: true,
    hideCombatActions: true,
  });
  const roll = result?.rolls?.[0] ?? result;
  const avoided = Number(roll?.baseSuccessQty) > 0;
  if (avoided) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: movingActor }),
      content: `<p>${escapeHTML(game.i18n.format('YZEGS.Minefield.WaterAvoidance.Avoided', {
        actor: movingActor.name,
      }))}</p>`,
    });
  }
  return avoided;
}

function activeResults(roll) {
  return roll.dice.flatMap(die => die.results.filter(result => result.active).map(result => result.result));
}

function renderMinefieldCard(data) {
  const title = escapeHTML(game.i18n.localize('YZEGS.Minefield.Result.Title'));
  const summary = escapeHTML(game.i18n.format('YZEGS.Minefield.Result.Summary', {
    checks: data.checks,
    triggers: data.attempts,
    duds: data.duds,
    detonations: data.detonations,
  }));
  const appliedStatus = data.applied
    ? `<p><i class="fas fa-check"></i> ${escapeHTML(game.i18n.localize('YZEGS.Minefield.Result.Applied'))}</p>`
    : '';
  const apply = data.detonations > 0 && !data.applied
    ? `<button type="button" class="dice-button apply-minefield-direct" data-gm-only="true">
        <i class="fas fa-heart-crack"></i> ${escapeHTML(game.i18n.localize('YZEGS.Minefield.Result.ApplyDirect'))}
      </button>`
    : '';
  const blast = data.detonations > 0 && !data.blastResolved
    && ['A', 'B', 'C', 'D'].includes(data.attackData.blast)
    ? `<button type="button" class="dice-button resolve-minefield-blast" data-gm-only="true">
        <i class="fas fa-burst"></i> ${escapeHTML(game.i18n.localize('YZEGS.Minefield.Result.ResolveBlast'))}
      </button>`
    : '';
  const collapse = data.detonations > 0 && data.attackData.confinedSpace && !data.collapseResolved
    ? `<button type="button" class="dice-button resolve-minefield-collapse" data-gm-only="true">
        <i class="fas fa-house-crack"></i> ${escapeHTML(
    game.i18n.localize('YZEGS.ConfinedSpace.Collapse.Resolve'),
  )}</button>`
    : '';
  return `<div class="yzegs chat-card minefield-card"><h3><i class="fas fa-burst"></i> ${title}</h3>
    <p>${escapeHTML(data.actorName)}</p><p>${summary}</p>
    ${appliedStatus}${apply}${blast}${collapse}</div>`;
}

async function postDetectionResult(typeData, actor) {
  const detail = game.i18n.format('YZEGS.Minefield.Detection.SpottedDetail', {
    actor: actor.name,
    region: typeData.region?.name ?? game.i18n.localize('YZEGS.Minefield.Region.Label'),
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="yzegs chat-card minefield-card"><h3><i class="fas fa-eye"></i>
      ${escapeHTML(game.i18n.localize('YZEGS.Minefield.Detection.Spotted'))}</h3>
      <p>${escapeHTML(detail)}</p></div>`,
  });
}

export async function resolveMinefieldRegionEvent(typeData, event) {
  const token = event.data?.token;
  const actor = token?.actor;
  const waterMine = typeData.environment === 'water';
  if (waterMine) {
    if (actor?.type !== 'vehicle'
      || !['watercraft', 'amphibious'].includes(actor.system.domain)
      || !canWaterMineAffectVessel(actor.system.watercraft?.size, typeData.maximumSafeSize)) return false;
  }
  else if (!actor || !minefieldAffectsActor(typeData.mineType, actor.type)) return false;
  const selection = await chooseMinefieldMovement(typeData, actor);
  if (selection.cancelled) return false;
  const bottomMine = typeData.waterMineType === 'bottom';
  const canDetect = !waterMine || !bottomMine || actor.system.watercraft?.mineDetectionEquipment;
  if (canDetect && await attemptDetection(typeData, selection, actor)) {
    await postDetectionResult(typeData, actor);
    return true;
  }
  if (waterMine && await attemptWaterMineAvoidance(typeData, actor)) return true;

  const checks = waterMine && !typeData.discovered ? 1 : getMinefieldExposureCount({
    density: typeData.density,
    hexes: selection.hexes,
    entrants: selection.entrants,
  });
  const triggerDie = getMinefieldTriggerDie(selection.mode);
  let triggerRoll = null;
  let triggerResults = [];
  let attempts = 0;
  if (waterMine) attempts = 1;
  else {
    triggerRoll = checks ? await new Roll(`${checks}d${triggerDie}`).evaluate() : null;
    triggerResults = triggerRoll ? activeResults(triggerRoll) : [];
    attempts = triggerResults.filter(value => value === 1).length;
  }
  const dudRoll = attempts ? await new Roll(`${attempts}d6`).evaluate() : null;
  const result = resolveMinefieldTriggers(triggerResults, dudRoll ? activeResults(dudRoll) : [], typeData.condition);
  const data = {
    ...result,
    checks,
    actorUuid: actor.uuid,
    actorName: actor.name,
    tokenUuid: token.uuid,
    applied: false,
    blastResolved: false,
    collapseResolved: false,
    attackData: {
      damage: Math.max(0, Number(typeData.damage) || 0),
      crit: Math.max(0, Number(typeData.crit) || 0),
      blast: String(typeData.blast ?? '–').toLocaleUpperCase(),
      armorModifier: Number(typeData.armorModifier) || 0,
      airburst: Boolean(typeData.airburst),
      directional: Boolean(typeData.directional),
      confinedSpace: isConfinedSpaceScene(),
      sourceActorUuid: '',
      waterMine,
    },
  };
  const rolls = [triggerRoll, dudRoll].filter(Boolean);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    rolls,
    content: renderMinefieldCard(data),
    flags: { [SYSTEM_ID]: { minefieldResolution: data } },
  });
  return true;
}

export async function applyMinefieldDirectDamage(message) {
  if (!game.user.isGM) return false;
  const data = foundry.utils.deepClone(message.getFlag(SYSTEM_ID, 'minefieldResolution'));
  if (!data || data.applied || data.detonations < 1) return false;
  const actorDocument = await resolveUuid(data.actorUuid);
  const actor = actorDocument?.actor ?? actorDocument;
  if (!actor) return false;
  if (actor.type === 'vehicle') {
    for (let index = 0; index < data.detonations; index++) {
      await actor.applyDamage(data.attackData.damage, {
        ...foundry.utils.deepClone(data.attackData),
        vehicleFacing: 'front',
        forceHullBreachOnPenetration: Boolean(data.attackData.waterMine),
      }, true);
    }
  }
  else {
    for (let index = 0; index < data.detonations; index++) {
      await actor.applyDamage(data.attackData.damage, {
        ...foundry.utils.deepClone(data.attackData),
        location: 'legs',
      }, true);
    }
  }
  data.applied = true;
  await message.update({
    content: renderMinefieldCard(data),
    [`flags.${SYSTEM_ID}.minefieldResolution`]: data,
  });
  return true;
}

export async function resolveMinefieldBlast(message, tokens) {
  if (!game.user.isGM) return false;
  const data = foundry.utils.deepClone(message.getFlag(SYSTEM_ID, 'minefieldResolution'));
  if (!data || data.detonations < 1) return false;
  const result = await resolveBlastTargets({
    name: game.i18n.localize('YZEGS.Minefield.Result.Title'),
    options: { actorUuid: '', attackData: data.attackData },
  }, tokens);
  if (!result) return false;
  data.blastResolved = true;
  await message.update({
    content: renderMinefieldCard(data),
    [`flags.${SYSTEM_ID}.minefieldResolution`]: data,
  });
  return true;
}

export async function resolveMinefieldCollapse(message) {
  if (!game.user.isGM) return false;
  const data = foundry.utils.deepClone(message.getFlag(SYSTEM_ID, 'minefieldResolution'));
  if (!data || data.detonations < 1 || !data.attackData.confinedSpace || data.collapseResolved) return false;
  const result = await resolveStandaloneCollapse(data.attackData.blast);
  if (!result) return false;
  data.collapseResolved = true;
  await message.update({
    content: renderMinefieldCard(data),
    [`flags.${SYSTEM_ID}.minefieldResolution`]: data,
  });
  return true;
}
