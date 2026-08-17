import { YZEGSRoller } from '../components/roll/dice.js';
import { getEffectiveAttackSuccesses } from './defense.js';
import {
  advanceSuppressionTurn,
  applySuppressionStress,
  attackCausesSuppression,
  getEnclosingVehicle,
  queueSuppressionTurn,
} from './suppression.js';
import { clearCloseQuartersEngagement } from './urban-workflows.js';

export const SUPPRESSION_SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const SUPPRESSION_SOCKET = `system.${SUPPRESSION_SYSTEM_ID}`;
export const SUPPRESSION_FLAG = 'suppressionTurn';

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

function actorFromDocument(doc) {
  return doc?.actor ?? doc;
}

function messageAuthorId(message) {
  return message?.author?.id ?? message?.user?.id ?? message?.user ?? '';
}

function isResponsibleUpdater(message) {
  const authorId = messageAuthorId(message);
  if (authorId && game.users.get(authorId)?.active) return game.user.id === authorId;
  const activeGMs = [...game.users].filter(user => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id));
  return activeGMs[0]?.id === game.user.id;
}

function ownsActor(user, actor) {
  return Boolean(user && actor && (
    user.isGM || actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
  ));
}

function canUpdate(message) {
  return Boolean(message && (game.user.isGM || message.isAuthor));
}

function activeCombatFor(actor) {
  const combat = game.combat;
  if (!combat?.started || Number(combat.round) <= 0) return null;
  return [...(combat.combatants ?? [])].some(combatant => combatant.actor?.uuid === actor?.uuid)
    ? combat
    : null;
}

function tokenDocumentFor(actor, tokenUuid = '') {
  if (tokenUuid) {
    try {
      // eslint-disable-next-line no-undef
      const doc = fromUuidSync(tokenUuid);
      if (doc) return doc.document ?? doc;
    }
    catch (_error) { /* Fall through to an active token. */ }
  }
  return actor?.getActiveTokens?.(true, true)?.[0]?.document ?? actor?.token ?? null;
}

function tokenCellKey(token) {
  if (!token) return '';
  const center = token.object?.center ?? {
    x: Number(token.x) + (Number(token.width) || 1) * (Number(token.parent?.grid?.size) || 100) / 2,
    y: Number(token.y) + (Number(token.height) || 1) * (Number(token.parent?.grid?.size) || 100) / 2,
  };
  try {
    const grid = canvas?.scene?.id === token.parent?.id ? canvas.grid : null;
    const offset = grid?.getOffset?.(center);
    if (Array.isArray(offset)) return offset.join(':');
    if (offset && Number.isFinite(offset.i) && Number.isFinite(offset.j)) return `${offset.i}:${offset.j}`;
  }
  catch (_error) { /* Older grids use the coordinate fallback below. */ }
  const canvasSize = canvas?.scene?.id === token.parent?.id ? Number(canvas.grid?.size) : 0;
  const size = Number(token.parent?.grid?.size) || canvasSize || 100;
  return `${Math.floor(center.x / size)}:${Math.floor(center.y / size)}`;
}

function targetDescriptor(actor, token = null, { cause = 'fire', sourceName = '', force = false } = {}) {
  const enclosing = getEnclosingVehicle(actor, game.actors);
  return {
    actorUuid: actor.uuid,
    tokenUuid: token?.uuid ?? token?.document?.uuid ?? actor.token?.uuid ?? '',
    name: actor.name,
    cause,
    force,
    sourceName,
    status: actor.type === 'vehicle' || enclosing ? 'immune' : 'pending',
    vehicleName: actor.type === 'vehicle' ? actor.name : enclosing?.vehicle?.name ?? '',
  };
}

/** Add one newly affected fighter to an attack without duplicating CUF checks. */
export function addSuppressionTarget(roll, actor, token = null, options = {}) {
  const suppression = roll?.options?.suppression;
  if (!suppression || !actor?.uuid || !['character', 'npc', 'vehicle'].includes(actor.type)) return false;
  suppression.targets ??= [];
  if (suppression.targets.some(entry => entry.actorUuid === actor.uuid)) return false;
  suppression.targets.push(targetDescriptor(actor, token, options));
  suppression.complete = suppression.targets.every(entry => entry.status !== 'pending');
  return true;
}

/** Assign a selected token after an attack was rolled without a target. */
export async function assignSuppressionTarget(message, token) {
  if (!message || !token?.actor || !canUpdate(message)) return false;
  const roll = message.rolls?.[0];
  if (!attackCausesSuppression({
    attackSuccesses: getEffectiveAttackSuccesses(roll),
    ammoSuccesses: roll?.hitCount,
  })) return false;
  if (!addSuppressionTarget(roll, token.actor, token.document ?? token, {
    cause: 'fire',
    sourceName: actorFromDocument(await resolveUuid(roll.options.actorUuid))?.name ?? '',
  })) return false;
  const content = await roll.render();
  await message.update({ content, rolls: [JSON.stringify(roll)] });
  return true;
}

/** Find friendly, conscious fighters sharing the failed Actor's grid space. */
export function findPanicTargets(actor, tokenUuid, checkedActorUuids = []) {
  const sourceToken = tokenDocumentFor(actor, tokenUuid);
  const scene = sourceToken?.parent;
  if (!scene?.tokens) return [];
  const sourceCell = tokenCellKey(sourceToken);
  const checked = new Set(checkedActorUuids);
  const results = [];

  for (const token of [...scene.tokens]) {
    if (token.disposition !== sourceToken.disposition) continue;
    if (tokenCellKey(token) !== sourceCell) continue;
    const tokenActor = token.actor;
    const targets = tokenActor?.type === 'vehicle'
      ? (tokenActor.system.crew?.occupants ?? []).map(entry => game.actors.get(entry.id)).filter(Boolean)
      : [tokenActor];
    for (const target of targets) {
      if (!['character', 'npc'].includes(target?.type)) continue;
      if (target.uuid === actor.uuid || checked.has(target.uuid)) continue;
      if (Number(target.system.health?.value) <= 0) continue;
      results.push(targetDescriptor(target, token, { cause: 'panic', sourceName: actor.name }));
      checked.add(target.uuid);
    }
  }
  return results;
}

function hasPotentialUnitMoraleSupport(actor, tokenUuid) {
  const sourceToken = tokenDocumentFor(actor, tokenUuid);
  const scene = sourceToken?.parent;
  if (!scene?.tokens) return false;
  return [...scene.tokens].some(token => (
    ['character', 'npc'].includes(token.actor?.type)
    && token.actor.uuid !== actor.uuid
    && Number(token.actor.system.health?.value) > 0
    && token.disposition === sourceToken.disposition
  ));
}

async function setStatus(actor, statusId, active) {
  if (actor.statuses?.has?.(statusId) === active) return;
  await actor.toggleStatusEffect(statusId, { active });
}

/** Apply the immediate and deferred consequences of a failed CUF check. */
export async function applySuppressionFailure(actor) {
  const combat = activeCombatFor(actor);
  const existing = actor.getFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG);
  const state = queueSuppressionTurn(existing, { combatId: combat?.id ?? '' });
  await actor.update({
    'system.sanity.value': applySuppressionStress(actor.system.sanity?.value),
  });
  await actor.setFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG, state);
  await setStatus(actor, 'prone', true);
  await setStatus(actor, 'suppressed', true);
  await clearCloseQuartersEngagement(actor);
  return state;
}

async function updateAttackSuppression(message, {
  targetActorUuid, outcome, vehicleName = '', panicTargets = [],
} = {}) {
  const roll = message?.rolls?.[0];
  const suppression = roll?.options?.suppression;
  if (!roll || !suppression) return false;
  if (!attackCausesSuppression({
    attackSuccesses: getEffectiveAttackSuccesses(roll),
    ammoSuccesses: roll.hitCount,
  })) {
    for (const entry of suppression.targets ?? []) {
      if (entry.status === 'pending' && !entry.force) entry.status = 'notRequired';
    }
  }
  const target = suppression.targets?.find(entry => entry.actorUuid === targetActorUuid);
  if (!target || target.status !== 'pending') return false;
  target.status = outcome;
  if (vehicleName) target.vehicleName = vehicleName;

  const known = new Set(suppression.targets.map(entry => entry.actorUuid));
  for (const panicTarget of panicTargets) {
    if (known.has(panicTarget.actorUuid)) continue;
    suppression.targets.push(panicTarget);
    known.add(panicTarget.actorUuid);
  }
  suppression.complete = suppression.targets.every(entry => entry.status !== 'pending');
  const content = await roll.render();
  await message.update({ content, rolls: [JSON.stringify(roll)] });
  return true;
}

async function submitSuppressionResolution(message, resolution) {
  if (canUpdate(message)) return updateAttackSuppression(message, resolution);
  game.socket.emit(SUPPRESSION_SOCKET, {
    type: 'suppressionResolution',
    messageId: message.id,
    resolution,
    responderId: game.user.id,
  });
  return true;
}

/** Roll and immediately resolve one CUF check requested by an attack card. */
export async function rollSuppressionCheck(message, targetActorUuid) {
  const attackRoll = message?.rolls?.[0];
  const suppression = attackRoll?.options?.suppression;
  const targetData = suppression?.targets?.find(entry => entry.actorUuid === targetActorUuid);
  const actor = actorFromDocument(await resolveUuid(targetActorUuid));
  if (!message || !attackRoll || !targetData || targetData.status !== 'pending' || !actor) return false;
  if (!game.user.isGM && !actor.isOwner) return false;
  if (!suppression.force && !targetData.force && !attackCausesSuppression({
    attackSuccesses: getEffectiveAttackSuccesses(attackRoll),
    ammoSuccesses: attackRoll.hitCount,
  })) return false;

  const enclosing = getEnclosingVehicle(actor, game.actors);
  if (actor.type === 'vehicle' || enclosing) {
    await submitSuppressionResolution(message, {
      targetActorUuid,
      outcome: 'immune',
      vehicleName: actor.type === 'vehicle' ? actor.name : enclosing?.vehicle?.name ?? '',
      panicTargets: [],
    });
    return true;
  }

  if (suppression.blast) await setStatus(actor, 'prone', true);

  const cufMessage = await YZEGSRoller.cufCheck({
    actor,
    // The dialog remains editable because line of sight is a table/canvas judgment.
    unitMorale: hasPotentialUnitMoraleSupport(actor, targetData.tokenUuid),
    messageMode: 'public',
    suppression: {
      attackMessageId: message.id,
      targetActorUuid,
      cause: targetData.cause,
      sourceName: targetData.sourceName,
    },
  });
  if (!cufMessage) return null;
  const cufRoll = cufMessage.rolls?.[0];
  const success = Number(cufRoll?.baseSuccessQty) > 0;
  let panicTargets = [];
  if (!success) {
    await applySuppressionFailure(actor);
    panicTargets = findPanicTargets(
      actor,
      targetData.tokenUuid,
      suppression.targets.map(entry => entry.actorUuid),
    );
  }

  cufRoll.options.suppression = {
    ...cufRoll.options.suppression,
    outcome: success ? 'success' : 'failure',
    effectsApplied: !success,
    panicCount: panicTargets.filter(entry => entry.status === 'pending').length,
  };
  const cufContent = await cufRoll.render();
  await cufMessage.update({ content: cufContent, rolls: [JSON.stringify(cufRoll)] });
  await submitSuppressionResolution(message, {
    targetActorUuid,
    outcome: success ? 'success' : 'failure',
    panicTargets,
  });
  return true;
}

async function handleSuppressionSocket(payload) {
  const message = game.messages.get(payload.messageId);
  if (!message || !isResponsibleUpdater(message)) return;
  const actor = actorFromDocument(await resolveUuid(payload.resolution?.targetActorUuid));
  const responder = game.users.get(payload.responderId);
  if (!ownsActor(responder, actor)) return;
  await updateAttackSuppression(message, payload.resolution);
}

export function registerSuppressionSocket() {
  game.socket.on(SUPPRESSION_SOCKET, payload => {
    if (payload?.type !== 'suppressionResolution') return;
    handleSuppressionSocket(payload)
      .catch(error => console.error('yzegs | Suppression socket update failed.', error));
  });
}

/** Consume and expire deferred suppression action losses as the active turn changes. */
export async function advanceCombatSuppression(combat, changes, userId) {
  if (!Object.hasOwn(changes, 'turn') && !Object.hasOwn(changes, 'round')) return [];
  if (!game.user.isGM || userId !== game.user.id) return [];
  const currentUuid = combat.combatant?.actor?.uuid ?? '';
  const seen = new Set();
  const updated = [];

  for (const combatant of [...(combat?.combatants ?? [])]) {
    const actor = combatant.actor;
    if (!['character', 'npc'].includes(actor?.type) || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    const state = actor.getFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG);
    if (!state) continue;
    const transition = advanceSuppressionTurn(state, {
      combatId: combat.id,
      isActorTurn: actor.uuid === currentUuid,
    });
    if (transition.effect === 'clear') {
      await actor.unsetFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG);
      await setStatus(actor, 'suppressed', false);
    }
    else {
      if (transition.state.phase !== state.phase || transition.state.queued !== state.queued) {
        await actor.setFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG, transition.state);
      }
      if (transition.effect === 'activate') {
        await actor.update({
          'system.actions.fast.value': 0,
          'system.actions.slow.value': 0,
        });
      }
    }
    updated.push(actor);
  }
  return updated;
}

/** Remove temporal suppression markers when their encounter is deleted. */
export async function clearCombatSuppression(combat, userId) {
  if (!game.user.isGM || userId !== game.user.id) return [];
  const actors = [];
  const seen = new Set();
  for (const combatant of [...(combat?.combatants ?? [])]) {
    const actor = combatant.actor;
    if (!actor?.uuid || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    const state = actor.getFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG);
    if (state?.combatId !== combat.id) continue;
    await actor.unsetFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG);
    await setStatus(actor, 'suppressed', false);
    actors.push(actor);
  }
  return actors;
}

/** Clear deferred suppression when a combatant leaves its encounter early. */
export async function clearCombatantSuppression(combatant, userId) {
  if (!game.user.isGM || userId !== game.user.id) return false;
  const actor = combatant?.actor;
  const state = actor?.getFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG);
  if (!actor || state?.combatId !== combatant.parent?.id) return false;
  await actor.unsetFlag(SUPPRESSION_SYSTEM_ID, SUPPRESSION_FLAG);
  await setStatus(actor, 'suppressed', false);
  return true;
}
