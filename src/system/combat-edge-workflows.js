import { getCombatModifierDefinitions } from './combat-modifiers.js';
import {
  getCloseCombatEdges,
  getMachineGunSupportRule,
  getOneHandedRule,
  getRangeBand,
  getRangedCombatEdges,
  RANGE_BANDS,
} from './combat-edge-rules.js';
import { getActorTacticalTerrain, getTerrainRangedModifier } from './tactical-terrain.js';

function hasStatus(actor, id) {
  return Boolean(actor?.statuses?.has?.(id));
}

export function isDefenseless(actor) {
  return Boolean(actor && (
    ['dead', 'incapacitatedDamage', 'incapacitatedStress', 'sleep', 'stun']
      .some(id => hasStatus(actor, id))
    || Number(actor.system?.health?.value) <= 0
    || Number(actor.system?.sanity?.value) <= 0
  ));
}

export async function recordCombatMovement(token, changes, userId) {
  if (userId !== game.user.id || (!Object.hasOwn(changes, 'x') && !Object.hasOwn(changes, 'y'))) return;
  const combat = game.combat;
  const combatant = [...(combat?.combatants ?? [])].find(entry => entry.tokenId === token.id);
  if (!combat?.started || !combatant?.actor) return;
  await combatant.actor.setFlag('fvtt-yze-generic-stepped', 'combatMovement', {
    combatId: combat.id,
    round: Number(combat.round) || 0,
    turn: Number(combat.turn) || 0,
  });
}

export function movedSincePreviousTurn(attacker, movingActor) {
  const combat = game.combat;
  const movement = movingActor?.getFlag?.('fvtt-yze-generic-stepped', 'combatMovement');
  if (!combat?.started || movement?.combatId !== combat.id) return false;
  const attackerIndex = combat.turns.findIndex(entry => entry.actor?.uuid === attacker?.uuid);
  if (Number(movement.round) === Number(combat.round)) return true;
  return Number(movement.round) === Number(combat.round) - 1
    && Number(movement.turn) > attackerIndex;
}

function actorToken(actor) {
  return actor?.token?.object
    ?? actor?.getActiveTokens?.(true, true)?.find(token => token.scene?.id === canvas.scene?.id)
    ?? actor?.getActiveTokens?.(true, true)?.[0]
    ?? null;
}

function tokenCenter(token) {
  return token?.center ?? token?.object?.center ?? null;
}

export function measureCombatDistance(attacker, target) {
  const source = actorToken(attacker);
  const destination = actorToken(target);
  const sourceCenter = tokenCenter(source);
  const targetCenter = tokenCenter(destination);
  const sourceScene = source?.document?.parent ?? source?.parent;
  const targetScene = destination?.document?.parent ?? destination?.parent;
  if (!sourceCenter || !targetCenter || !canvas.grid || sourceScene?.id !== targetScene?.id) return null;
  const sourceOffset = canvas.grid.getOffset(sourceCenter);
  const targetOffset = canvas.grid.getOffset(targetCenter);
  const sameHex = sourceOffset.i === targetOffset.i && sourceOffset.j === targetOffset.j;
  const measured = Number(canvas.grid.measurePath([sourceCenter, targetCenter]).distance) || 0;
  const units = String(sourceScene?.grid?.units ?? '').toLocaleLowerCase();
  let battleHexes;
  if (/^(m|meter|meters|metre|metres)$/.test(units)) battleHexes = measured / 10;
  else if (/^(km|kilometer|kilometers|kilometre|kilometres)$/.test(units)) battleHexes = measured * 100;
  else battleHexes = measured / Math.max(1, Number(sourceScene?.grid?.distance) || 1);
  const sourceElevation = Number(source?.document?.elevation ?? source?.elevation) || 0;
  const targetElevation = Number(destination?.document?.elevation ?? destination?.elevation) || 0;
  return { source, destination, sameHex, battleHexes, elevated: sourceElevation > targetElevation };
}

export function measureCombatPointDistance(attacker, point) {
  const source = actorToken(attacker);
  const sourceCenter = tokenCenter(source);
  const sourceScene = source?.document?.parent ?? source?.parent;
  if (!sourceCenter || !point || !canvas.grid || sourceScene?.id !== point.sceneId) return null;
  const targetCenter = { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  const sourceOffset = canvas.grid.getOffset(sourceCenter);
  const targetOffset = canvas.grid.getOffset(targetCenter);
  const sameHex = sourceOffset.i === targetOffset.i && sourceOffset.j === targetOffset.j;
  const measured = Number(canvas.grid.measurePath([sourceCenter, targetCenter]).distance) || 0;
  const gridDistance = Math.max(1, Number(sourceScene?.grid?.distance) || 1);
  const gridSpaces = measured / gridDistance;
  const units = String(sourceScene?.grid?.units ?? '').toLocaleLowerCase();
  let battleHexes;
  if (/^(m|meter|meters|metre|metres)$/.test(units)) battleHexes = measured / 10;
  else if (/^(km|kilometer|kilometers|kilometre|kilometres)$/.test(units)) battleHexes = measured * 100;
  else battleHexes = gridSpaces;
  const sourceElevation = Number(source?.document?.elevation ?? source?.elevation) || 0;
  return { source, destination: null, sameHex, battleHexes, gridSpaces, elevated: sourceElevation > 0 };
}

export function findFriendlyFireTargets(attacker, target) {
  const source = actorToken(attacker);
  const destination = actorToken(target);
  const sourceCenter = tokenCenter(source);
  const targetCenter = tokenCenter(destination);
  if (!sourceCenter || !targetCenter || !canvas.grid) return [];
  const sourceOffset = canvas.grid.getOffset(sourceCenter);
  const targetOffset = canvas.grid.getOffset(targetCenter);
  const path = canvas.grid.getDirectPath([sourceOffset, targetOffset]);
  const crossed = new Set(path.slice(1, -1).map(offset => `${offset.i}:${offset.j}`));
  if (!crossed.size) return [];
  const sourceDisposition = source.document?.disposition ?? source.disposition;
  return (canvas.tokens?.placeables ?? []).filter(token => {
    if (!['character', 'npc'].includes(token.actor?.type)) return false;
    if ([attacker?.uuid, target?.uuid].includes(token.actor.uuid)) return false;
    if ((token.document?.disposition ?? token.disposition) !== sourceDisposition) return false;
    const offset = canvas.grid.getOffset(tokenCenter(token));
    return crossed.has(`${offset.i}:${offset.j}`);
  }).map(token => ({
    actor: token.actor,
    token,
    actorUuid: token.actor.uuid,
    tokenUuid: token.document?.uuid ?? '',
    name: token.actor.name,
  }));
}

async function resolveUuid(uuid) {
  try { return uuid ? await fromUuid(uuid) : null; }
  catch (_error) { return null; }
}

export async function resolveFriendlyFire(message) {
  if (!game.user.isGM) return false;
  const attackRoll = message?.rolls?.[0];
  const attackData = attackRoll?.options?.attackData;
  if (!attackData?.friendlyFireTargets?.length || attackData.friendlyFireResolved
    || Number(attackRoll.baseSuccessQty) > 0) return false;
  const check = await new Roll('2d6').evaluate();
  const successes = check.dice.flatMap(die => die.results).filter(result => result.result === 6).length;
  let target = null;
  let damage = 0;
  if (successes) {
    const candidates = await Promise.all(attackData.friendlyFireTargets.map(entry => resolveUuid(entry.actorUuid)));
    const available = candidates.filter(Boolean);
    target = available[Math.floor(Math.random() * available.length)] ?? null;
    if (target) {
      damage = Math.max(0, Number(attackData.damage) || 0) + successes - 1;
      const hitData = foundry.utils.deepClone(attackData);
      hitData.location = CONFIG.YZEGS.hitLocs[Math.floor(Math.random() * CONFIG.YZEGS.hitLocs.length)];
      delete hitData.cover;
      delete hitData.coverType;
      delete hitData.coverBarriers;
      await target.applyDamage(damage, hitData, damage !== 0);
    }
  }
  attackData.friendlyFireResolved = true;
  attackData.friendlyFireHit = Boolean(target);
  const content = await attackRoll.render();
  await message.update({ content, rolls: [JSON.stringify(attackRoll)] });
  await check.toMessage({
    flavor: target
      ? game.i18n.format('YZEGS.CombatEdges.FriendlyFireHit', { target: target.name, damage })
      : game.i18n.localize('YZEGS.CombatEdges.FriendlyFireMiss'),
  });
  return true;
}

function describeModifiers(modifiers) {
  const definitions = new Map(getCombatModifierDefinitions().map(entry => [entry.id, entry]));
  return modifiers.map(modifier => {
    const definition = definitions.get(modifier.id);
    const value = Number(modifier.value) || 0;
    let displayValue = '–';
    if (value > 0) displayValue = `+${value}`;
    else if (value < 0) displayValue = `−${Math.abs(value)}`;
    return {
      ...modifier,
      label: definition?.name ?? game.i18n.localize(`YZEGS.CombatEdges.Modifiers.${modifier.id}`),
      displayValue,
    };
  });
}

export function prepareCloseCombatEdges(attacker, target) {
  const distance = measureCombatDistance(attacker, target);
  const result = getCloseCombatEdges({
    attackerProne: hasStatus(attacker, 'prone'),
    targetProne: hasStatus(target, 'prone'),
    defenseless: isDefenseless(target),
  });
  return {
    ...result,
    modifiers: describeModifiers(result.modifiers),
    differentHex: Boolean(distance && !distance.sameHex),
  };
}

export function prepareRangedCombatEdges(attacker, target, item) {
  const supportRule = getMachineGunSupportRule(item?.system?.itemType, item?.system?.props);
  const distance = measureCombatDistance(attacker, target);
  if (!distance) {
    const fallback = getRangedCombatEdges({ supportRule });
    return {
      ...fallback,
      modifiers: describeModifiers(fallback.modifiers),
      band: '',
      oneHanded: getOneHandedRule(item?.system?.itemType),
    };
  }
  const band = getRangeBand(distance.battleHexes, item?.system?.range, distance.sameHex);
  const fireControlRange = Boolean(
    item?.actor?.type === 'vehicle'
    && item.system.featuresForVehicle?.fcs
    && item.actor.system.components?.fcs?.active
    && Number(item.actor.system.components.fcs.damage) < 1
    && ![RANGE_BANDS.SAME_HEX, RANGE_BANDS.OUT_OF_RANGE].includes(band),
  );
  const vehicleType = String(target?.system?.vehicleType ?? '').toLocaleLowerCase();
  const attackerTerrain = getActorTacticalTerrain(attacker);
  const targetTerrain = getActorTacticalTerrain(target);
  const terrainElevation = Boolean(attackerTerrain?.elevated && !targetTerrain?.elevated);
  const result = getRangedCombatEdges({
    band: fireControlRange ? RANGE_BANDS.SHORT : band,
    itemType: item?.system?.itemType,
    shotgun: Boolean(item?.system?.props?.shotgun),
    targetProne: hasStatus(target, 'prone'),
    defenseless: isDefenseless(target),
    largeTarget: target?.type === 'vehicle'
      && item?.type === 'weapon'
      && !item?.system?.props?.heavyWeapon
      && !/motorcycle|motorbike|bicycle|bike/.test(vehicleType),
    supportRule,
    targetMoved: movedSincePreviousTurn(attacker, target),
    elevated: distance.elevated || terrainElevation,
  });
  const terrainModifier = distance.sameHex ? 0 : getTerrainRangedModifier(target);
  if (terrainModifier) {
    let id = 'ranged-assisted-target-terrain';
    if (terrainModifier === -1) id = 'ranged-target-terrain';
    else if (terrainModifier === -2) id = 'ranged-dense-target-terrain';
    result.modifiers.push({
      id,
      value: terrainModifier,
    });
  }
  return {
    ...result,
    band,
    distance: distance.battleHexes,
    modifiers: describeModifiers(result.modifiers),
    oneHanded: getOneHandedRule(item?.system?.itemType),
    oneHandedBeyondShort: ![RANGE_BANDS.SAME_HEX, RANGE_BANDS.SHORT].includes(band),
    fireControlRange,
  };
}

export function prepareRangedCombatPointEdges(attacker, point, item) {
  const supportRule = getMachineGunSupportRule(item?.system?.itemType, item?.system?.props);
  const distance = measureCombatPointDistance(attacker, point);
  if (!distance) {
    const fallback = getRangedCombatEdges({ supportRule });
    return {
      ...fallback,
      modifiers: describeModifiers(fallback.modifiers),
      band: '',
      oneHanded: getOneHandedRule(item?.system?.itemType),
    };
  }
  const band = getRangeBand(distance.battleHexes, item?.system?.range, distance.sameHex);
  const attackerTerrain = getActorTacticalTerrain(attacker);
  const result = getRangedCombatEdges({
    band,
    itemType: item?.system?.itemType,
    supportRule,
    elevated: distance.elevated || Boolean(attackerTerrain?.elevated),
  });
  return {
    ...result,
    band,
    distance: distance.battleHexes,
    gridSpaces: distance.gridSpaces,
    modifiers: describeModifiers(result.modifiers),
    oneHanded: getOneHandedRule(item?.system?.itemType),
    oneHandedBeyondShort: ![RANGE_BANDS.SAME_HEX, RANGE_BANDS.SHORT].includes(band),
    fireControlRange: false,
  };
}

export function sumEdgeModifiers(modifiers = []) {
  return modifiers.reduce((total, modifier) => total + (Number(modifier.value) || 0), 0);
}
