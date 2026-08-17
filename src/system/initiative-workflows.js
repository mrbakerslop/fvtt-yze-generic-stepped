import YZEGSDialog from '../components/dialog/dialog.js';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getActionSkillName, getActorActionSkill } from './action-skills.js';
import { getSkillCombatType } from './combat-modifiers.js';
import { isActorInActiveCombat } from './reloading.js';
import {
  availableInitiativeCards,
  chooseInitiativeCard,
  drawInitiativeCandidates,
  getAmbushRangeModifier,
  getWaylaySetupModifier,
  resolveAmbush,
  topInitiativeCards,
} from './initiative-rules.js';
import { getTerrainInfiltrationModifier } from './tactical-terrain.js';

export const INITIATIVE_SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const INITIATIVE_SOCKET = `system.${INITIATIVE_SYSTEM_ID}`;

function localize(key, data = null) {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

async function resolveUuid(uuid) {
  try { return uuid ? await fromUuid(uuid) : null; }
  catch (_error) { return null; }
}

function ownsActor(user, actor) {
  return Boolean(user && actor && (
    user.isGM || actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
  ));
}

function activeGM() {
  return [...game.users].filter(user => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
}

function combatantForActor(combat, actor) {
  return [...(combat?.combatants ?? [])].find(combatant => (
    combatant.actor?.uuid === actor?.uuid || combatant.actorId === actor?.id
  ));
}

function participantActors(tokens) {
  return [...new Map([...tokens].map(token => token.actor)
    .filter(actor => ['character', 'npc'].includes(actor?.type))
    .map(actor => [actor.uuid, actor])).values()];
}

function selectedGroups() {
  return {
    attackers: participantActors(canvas.tokens.controlled ?? []),
    targets: participantActors(game.user.targets ?? []),
  };
}

function getSkill(actor, actionId, fallback = 'recon') {
  const skill = getActorActionSkill(actor, actionId, fallback);
  if (!skill) {
    ui.notifications.warn(localize('YZEGS.CombatActions.Errors.SkillMissing', {
      skill: getActionSkillName(actionId, fallback),
    }));
  }
  return skill;
}

function groupRepresentative(actors, actionId, mode) {
  const candidates = actors.map(actor => ({
    actor,
    skill: getSkill(actor, actionId),
  })).filter(entry => entry.skill);
  if (candidates.length !== actors.length) return null;
  candidates.sort((left, right) => {
    const difference = Number(left.skill.system.value) - Number(right.skill.system.value);
    return mode === 'highest' ? -difference : difference;
  });
  return candidates[0] ?? null;
}

function availableCards(combat, ignoredCombatantIds = []) {
  const ignored = new Set(ignoredCombatantIds);
  return availableInitiativeCards([...combat.combatants]
    .filter(combatant => !ignored.has(combatant.id))
    .map(combatant => combatant.initiative));
}

function initiativeImage(card) {
  return `systems/fvtt-yze-generic-stepped/assets/cards/initiative-${String(card).padStart(2, '0')}.svg`;
}

async function postInitiative(actor, card, candidates, labelKey = 'YZEGS.Initiative.Drawn') {
  const images = candidates.map(candidate => `<img src="${initiativeImage(candidate)}" alt="${candidate}"
    width="65"${candidate === card ? ' style="outline:3px solid #000"' : ''}>`).join(' ');
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: localize(labelKey, { actor: actor.name, card }),
    content: `<div class="yzegs chat-card initiative-card"><p>${images}</p></div>`,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

async function chooseCard(actor, candidates) {
  if (candidates.length < 2) return candidates[0] ?? null;
  const selected = await foundry.applications.api.DialogV2.wait({
    classes: ['yzegs', 'initiative-choice-dialog'],
    window: { title: localize('YZEGS.Initiative.ChooseTitle', { actor: actor.name }) },
    content: `<p>${localize('YZEGS.Initiative.ChooseHint')}</p>`,
    buttons: candidates.map(card => ({
      action: String(card),
      label: `<img src="${initiativeImage(card)}" alt="${card}" width="65">`,
      callback: () => card,
    })),
    rejectClose: false,
  });
  return Number(selected) || null;
}

/** Draw a unique initiative card for one existing combatant. */
export async function drawActorInitiative(actor, { choose = true } = {}) {
  const combat = game.combat;
  const combatant = combatantForActor(combat, actor);
  if (!combatant) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.NotCombatant'));
    return null;
  }
  if (!game.user.isGM && !ownsActor(game.user, actor)) return null;
  if (combatant.initiative !== null) {
    const redraw = await foundry.applications.api.DialogV2.confirm({
      classes: ['yzegs'],
      window: { title: localize('YZEGS.Initiative.RedrawTitle') },
      content: `<p>${localize('YZEGS.Initiative.RedrawHint', { actor: actor.name })}</p>`,
      yes: { label: localize('YZEGS.Initiative.Redraw'), default: true },
      no: { label: localize('YZEGS.Dialog.Actions.Cancel') },
    });
    if (!redraw) return null;
  }
  const cards = availableCards(combat, [combatant.id]);
  if (!cards.length) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.NoCards'));
    return null;
  }
  const count = Math.min(cards.length, Math.max(1, Math.trunc(Number(actor.system.drawSize) || 1)));
  const candidates = drawInitiativeCandidates(cards, count);
  const card = choose ? await chooseCard(actor, candidates) : chooseInitiativeCard(candidates);
  if (!card) return null;
  await combat.setInitiative(combatant.id, card);
  await postInitiative(actor, card, candidates);
  return card;
}

/** Deal unique initiative cards to every unresolved combatant. */
export async function dealCombatInitiative(combat = game.combat, combatants = null) {
  if (!game.user.isGM || !combat) return [];
  const pending = (combatants ?? [...combat.combatants]).filter(combatant => combatant.initiative === null);
  const results = [];
  for (const combatant of pending) {
    const actor = combatant.actor;
    if (!actor) continue;
    const cards = availableCards(combat, [combatant.id]);
    if (!cards.length) break;
    const count = Math.min(cards.length, Math.max(1, Math.trunc(Number(actor.system.drawSize) || 1)));
    const candidates = drawInitiativeCandidates(cards, count);
    const card = chooseInitiativeCard(candidates);
    await combat.setInitiative(combatant.id, card);
    await postInitiative(actor, card, candidates);
    results.push({ combatant, card });
  }
  if (results.length < pending.length) ui.notifications.warn(localize('YZEGS.Initiative.Errors.NoCards'));
  return results;
}

/** Give a selected surprising combatant card #1, before the remaining deal. */
export async function assignSurpriseInitiative(actor) {
  if (!game.user.isGM || !game.combat) return null;
  const combatant = combatantForActor(game.combat, actor);
  if (!combatant) return null;
  const occupant = [...game.combat.combatants].find(entry => (
    Number(entry.initiative) === 1 && entry.id !== combatant.id
  ));
  const updates = [{ _id: combatant.id, initiative: 1 }];
  if (occupant) updates.push({ _id: occupant.id, initiative: null });
  await game.combat.updateEmbeddedDocuments('Combatant', updates, { yzegsInitiativeSwap: true });
  await postInitiative(actor, 1, [1], 'YZEGS.Initiative.SurpriseAssigned');
  return 1;
}

function participantsData(actors) {
  return actors.map(actor => ({ uuid: actor.uuid, name: actor.name }));
}

function conflictResolution(data) {
  if (data.attackerSuccesses === null || data.targetSuccesses === null) return null;
  return resolveAmbush({
    attackerSuccesses: data.attackerSuccesses,
    targetSuccesses: data.targetSuccesses,
  });
}

async function renderConflict(data) {
  return foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/chat/initiative-conflict-chat.hbs',
    { data: { ...data, resolution: conflictResolution(data) } },
  );
}

async function updateConflict(message, data) {
  return message.update({
    content: await renderConflict(data),
    [`flags.${INITIATIVE_SYSTEM_ID}.initiativeConflict`]: data,
  });
}

function canUpdate(message) {
  return Boolean(message && (game.user.isGM || message.isAuthor));
}

async function applyConflictUpdate(message, operation, payload) {
  const data = message.getFlag(INITIATIVE_SYSTEM_ID, 'initiativeConflict');
  if (!data) return false;
  if (operation === 'roll') {
    data[`${payload.side}Successes`] = payload.successes;
    data[`${payload.side}Final`] = payload.final;
    data[`${payload.side}RollMessageId`] = payload.rollMessageId;
    if (data.mode === 'waylay' && payload.side === 'attacker' && payload.final) {
      data.status = payload.successes > 0 ? 'awaitingTargets' : 'setupFailed';
    }
    else if (data.attackerFinal && data.targetFinal) data.status = 'ready';
  }
  else if (operation === 'targets') {
    data.targets = payload.targets;
    data.leadTargetUuid = payload.leadTargetUuid;
    data.status = 'awaitingTargetRoll';
  }
  else if (operation === 'applied') {
    data.applied = true;
    data.status = payload.success ? 'ambushSucceeded' : 'ambushFailed';
  }
  return updateConflict(message, data);
}

async function submitConflictUpdate(message, operation, payload) {
  if (canUpdate(message)) return applyConflictUpdate(message, operation, payload);
  game.socket.emit(INITIATIVE_SOCKET, {
    type: 'initiativeConflict', messageId: message.id, operation, payload, responderId: game.user.id,
  });
  return true;
}

async function createConflict(data, actor) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderConflict(data),
    flags: { [INITIATIVE_SYSTEM_ID]: { initiativeConflict: data } },
  });
}

/** Create a stalking ambush from controlled attackers against targeted defenders. */
export async function createAmbush() {
  if (!game.user.isGM) return null;
  const { attackers, targets } = selectedGroups();
  if (!attackers.length || !targets.length) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.SelectGroups'));
    return null;
  }
  const leadAttacker = groupRepresentative(attackers, 'ambushSetup', 'lowest');
  const leadTarget = groupRepresentative(targets, 'ambushDetection', 'highest');
  if (!leadAttacker || !leadTarget) return null;
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/ambush-dialog.hbs',
    {
      rangeOptions: {
        same: localize('YZEGS.Initiative.Range.Same'),
        one: localize('YZEGS.Initiative.Range.One'),
        twoToFive: localize('YZEGS.Initiative.Range.TwoToFive'),
        sixToTwenty: localize('YZEGS.Initiative.Range.SixToTwenty'),
        twentyOnePlus: localize('YZEGS.Initiative.Range.TwentyOnePlus'),
      },
      terrainModifier: getTerrainInfiltrationModifier(leadAttacker.actor),
    },
  );
  const setup = await YZEGSDialog._wait({
    title: localize('YZEGS.Initiative.Ambush'),
    content,
    actionLabel: localize('YZEGS.Initiative.CreateAmbush'),
    processForm: form => ({
      range: form.elements.namedItem('range')?.value ?? 'twoToFive',
      terrainModifier: Number(form.elements.namedItem('terrainModifier')?.value) || 0,
      darknessModifier: Number(form.elements.namedItem('darknessModifier')?.value) || 0,
    }),
  });
  if (setup.cancelled) return null;
  return createConflict({
    mode: 'ambush',
    status: 'rolling',
    attackers: participantsData(attackers),
    targets: participantsData(targets),
    leadAttackerUuid: leadAttacker.actor.uuid,
    leadTargetUuid: leadTarget.actor.uuid,
    attackerModifier: getAmbushRangeModifier(setup.range) + setup.terrainModifier,
    targetModifier: setup.darknessModifier,
    range: setup.range,
    attackerSuccesses: null,
    targetSuccesses: null,
    attackerFinal: false,
    targetFinal: false,
    attackerRollMessageId: '',
    targetRollMessageId: '',
    applied: false,
  }, leadAttacker.actor);
}

async function spendWaylayAction(attackers, duration) {
  if (duration !== 'action') return true;
  const active = attackers.filter(actor => isActorInActiveCombat(actor, game.combat));
  if (!active.length) return true;
  if (active.some(actor => Number(actor.system.actions?.slow?.value) < 1)) {
    ui.notifications.warn(localize('YZEGS.CombatActions.NoSlowAction'));
    return false;
  }
  await Promise.all(active.map(actor => actor.update({
    'system.actions.slow.value': Number(actor.system.actions.slow.value) - 1,
  })));
  return true;
}

/** Create a stored waylay setup roll for controlled attackers. */
export async function createWaylay() {
  if (!game.user.isGM) return null;
  const attackers = participantActors(canvas.tokens.controlled ?? []);
  if (!attackers.length) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.SelectAttackers'));
    return null;
  }
  const lead = groupRepresentative(attackers, 'waylaySetup', 'lowest');
  if (!lead) return null;
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/waylay-dialog.hbs',
    { durationOptions: {
      action: localize('YZEGS.Initiative.WaylayDuration.Action'),
      stretch: localize('YZEGS.Initiative.WaylayDuration.Stretch'),
      shift: localize('YZEGS.Initiative.WaylayDuration.Shift'),
    } },
  );
  const setup = await YZEGSDialog._wait({
    title: localize('YZEGS.Initiative.Waylay'),
    content,
    actionLabel: localize('YZEGS.Initiative.SetWaylay'),
    processForm: form => ({ duration: form.elements.namedItem('duration')?.value ?? 'action' }),
  });
  if (setup.cancelled || !await spendWaylayAction(attackers, setup.duration)) return null;
  const message = await createConflict({
    mode: 'waylay',
    status: 'rollingSetup',
    attackers: participantsData(attackers),
    targets: [],
    leadAttackerUuid: lead.actor.uuid,
    leadTargetUuid: '',
    attackerModifier: getWaylaySetupModifier(setup.duration),
    targetModifier: 0,
    duration: setup.duration,
    attackerSuccesses: null,
    targetSuccesses: null,
    attackerFinal: false,
    targetFinal: false,
    attackerRollMessageId: '',
    targetRollMessageId: '',
    applied: false,
  }, lead.actor);
  await rollInitiativeConflictSide(message, 'attacker');
  return message;
}

function rollSuccesses(result) {
  return Number(result?.rolls?.[0]?.baseSuccessQty ?? result?.baseSuccessQty) || 0;
}

export async function rollInitiativeConflictSide(message, side) {
  const data = message?.getFlag(INITIATIVE_SYSTEM_ID, 'initiativeConflict');
  const actorUuid = side === 'attacker' ? data?.leadAttackerUuid : data?.leadTargetUuid;
  const actor = await resolveUuid(actorUuid);
  if (!data || !actor || !ownsActor(game.user, actor)
    || data[`${side}Final`] || data[`${side}RollMessageId`]) return false;
  const waylayTarget = data.mode === 'waylay' && side === 'target';
  let actionId;
  if (side === 'attacker') actionId = data.mode === 'waylay' ? 'waylaySetup' : 'ambushSetup';
  else actionId = data.mode === 'waylay' ? 'waylayDetection' : 'ambushDetection';
  const skill = getSkill(actor, actionId);
  if (!skill) return false;
  const result = await YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, actor),
    title: localize(side === 'attacker'
      ? 'YZEGS.Initiative.AttackerRollTitle'
      : 'YZEGS.Initiative.TargetRollTitle', { actor: actor.name }),
    actor,
    combatType: getSkillCombatType(skill),
    modifier: side === 'attacker' ? data.attackerModifier : data.targetModifier,
    maxPush: waylayTarget ? 0 : 1,
    lockMaxPush: true,
    askForOptions: waylayTarget ? false : !game.settings.get(INITIATIVE_SYSTEM_ID, 'showTaskCheckOptions'),
    skipDialog: waylayTarget,
    hideCombatActions: true,
    actionData: {
      workflow: 'initiativeConflict',
      declarationMessageId: message.id,
      side,
    },
  });
  if (!result) return false;
  const roll = result.rolls?.[0] ?? result;
  return submitConflictUpdate(message, 'roll', {
    side,
    successes: rollSuccesses(result),
    rollMessageId: result.id ?? '',
    final: !roll.pushable,
  });
}

/** Synchronize a declaration when its linked Recon roll is pushed or accepted. */
export async function syncInitiativeConflictRoll(rollMessage, { final = false } = {}) {
  const roll = rollMessage?.rolls?.[0];
  const actionData = roll?.options?.actionData;
  if (actionData?.workflow !== 'initiativeConflict') return false;
  const declaration = game.messages.get(actionData.declarationMessageId);
  if (!declaration) return false;
  return submitConflictUpdate(declaration, 'roll', {
    side: actionData.side,
    successes: Number(roll.baseSuccessQty) || 0,
    rollMessageId: rollMessage.id,
    final: final || !roll.pushable,
  });
}

export async function selectWaylayTargets(message) {
  if (!game.user.isGM) return false;
  const data = message?.getFlag(INITIATIVE_SYSTEM_ID, 'initiativeConflict');
  const targets = participantActors(game.user.targets ?? []);
  if (data?.mode !== 'waylay' || data.status !== 'awaitingTargets' || !targets.length) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.TargetDefenders'));
    return false;
  }
  const lead = groupRepresentative(targets, 'waylayDetection', 'highest');
  if (!lead) return false;
  await submitConflictUpdate(message, 'targets', {
    targets: participantsData(targets),
    leadTargetUuid: lead.actor.uuid,
  });
  return rollInitiativeConflictSide(message, 'target');
}

async function prepareCombatParticipants(data) {
  const actors = await Promise.all([...data.attackers, ...data.targets].map(entry => resolveUuid(entry.uuid)));
  const combat = game.combat;
  if (!combat || actors.some(actor => !combatantForActor(combat, actor))) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.AllMustBeCombatants'));
    return null;
  }
  return { combat, actors };
}

async function chooseAmbushAssignments(attackers, cards) {
  if (attackers.length === 1) return cards;
  const cardOptions = Object.fromEntries(cards.map(card => [card, `#${card}`]));
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/initiative-assignment-dialog.hbs',
    {
      assignments: attackers.map((actor, index) => ({
        actor,
        index,
        selected: cards[index],
      })),
      cardOptions,
    },
  );
  const result = await YZEGSDialog._wait({
    title: localize('YZEGS.Initiative.AssignTitle'),
    content,
    actionLabel: localize('YZEGS.Initiative.AssignCards'),
    processForm: form => ({
      cards: attackers.map((_actor, index) => Number(
        form.elements.namedItem(`card-${index}`)?.value,
      )),
    }),
  });
  if (result.cancelled) return null;
  if (result.cards.some(card => !cards.includes(card)) || new Set(result.cards).size !== attackers.length) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.UniqueAssignments'));
    return null;
  }
  return result.cards;
}

async function assignAmbushCards(data) {
  const prepared = await prepareCombatParticipants(data);
  if (!prepared) return false;
  const { combat } = prepared;
  const attackers = await Promise.all(data.attackers.map(entry => resolveUuid(entry.uuid)));
  const targets = await Promise.all(data.targets.map(entry => resolveUuid(entry.uuid)));
  const topCards = topInitiativeCards(attackers.length);
  if (topCards.length < attackers.length) return false;
  const assignments = await chooseAmbushAssignments(attackers, topCards);
  if (!assignments) return false;
  await combat.updateEmbeddedDocuments('Combatant', [...combat.combatants].map(combatant => ({
    _id: combatant.id, initiative: null,
  })));
  await combat.updateEmbeddedDocuments('Combatant', attackers.map((actor, index) => ({
    _id: combatantForActor(combat, actor).id,
    initiative: assignments[index],
  })));
  for (const [index, actor] of attackers.entries()) {
    await actor.setFlag(INITIATIVE_SYSTEM_ID, 'ambushOpening', {
      combatId: combat.id,
      round: 1,
      targetUuids: targets.map(target => target.uuid),
      attackModifier: data.range === 'same' ? 3 : 0,
      available: true,
    });
    await postInitiative(actor, assignments[index], [assignments[index]], 'YZEGS.Initiative.AmbushAssigned');
  }
  const attackerUuids = new Set(attackers.map(actor => actor.uuid));
  await dealCombatInitiative(combat, [...combat.combatants].filter(combatant => (
    !attackerUuids.has(combatant.actor?.uuid)
  )));
  return true;
}

export async function applyInitiativeConflict(message) {
  if (!game.user.isGM) return false;
  const data = message?.getFlag(INITIATIVE_SYSTEM_ID, 'initiativeConflict');
  if (!data || data.status !== 'ready' || data.applied) return false;
  const resolution = conflictResolution(data);
  if (resolution.success) {
    if (!await assignAmbushCards(data)) return false;
  }
  else {
    const prepared = await prepareCombatParticipants(data);
    if (!prepared) return false;
    const combatants = [...prepared.combat.combatants];
    await prepared.combat.updateEmbeddedDocuments('Combatant', combatants.map(combatant => ({
      _id: combatant.id, initiative: null,
    })));
    await dealCombatInitiative(prepared.combat, combatants);
  }
  await submitConflictUpdate(message, 'applied', { success: resolution.success });
  return true;
}

function activeAmbushOpening(attacker, defender) {
  const opening = attacker?.getFlag(INITIATIVE_SYSTEM_ID, 'ambushOpening');
  return (
    opening?.available
    && opening.combatId === game.combat?.id
    && Number(game.combat?.round) === Number(opening.round)
    && opening.targetUuids?.includes(defender?.uuid)
  ) ? opening : null;
}

/** Whether this Actor's first-round ambush attack cannot be Blocked. */
export function ambushPreventsBlock(attacker, defender) {
  return Boolean(activeAmbushOpening(attacker, defender));
}

/** Return the close-range bonus attached to this Actor's pending ambush attack. */
export function getAmbushAttackModifier(attacker, defender) {
  return Number(activeAmbushOpening(attacker, defender)?.attackModifier) || 0;
}

export async function consumeAmbushOpening(attacker) {
  const opening = attacker?.getFlag(INITIATIVE_SYSTEM_ID, 'ambushOpening');
  if (!opening?.available) return false;
  await attacker.setFlag(INITIATIVE_SYSTEM_ID, 'ambushOpening', { ...opening, available: false });
  return true;
}

export async function clearCombatInitiativeState(combat, userId) {
  if (!game.user.isGM || userId !== game.user.id) return;
  await Promise.all([...combat.combatants].map(combatant => (
    combatant.actor?.unsetFlag(INITIATIVE_SYSTEM_ID, 'ambushOpening')
  )));
}

export async function exchangeActorInitiative(actor) {
  const combat = game.combat;
  const combatant = combatantForActor(combat, actor);
  if (!combat || !combatant || combat.combatant?.id !== combatant.id) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.ExchangeTurn'));
    return false;
  }
  const actions = actor.system.actions;
  if (Number(actions.fast.value) !== Number(actions.fast.max)
    || Number(actions.slow.value) !== Number(actions.slow.max)) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.ExchangeBeforeActions'));
    return false;
  }
  const candidates = [...combat.combatants].filter(entry => (
    entry.id !== combatant.id
    && entry.initiative !== null
    && Number(entry.initiative) > Number(combatant.initiative)
  ));
  if (!candidates.length) {
    ui.notifications.warn(localize('YZEGS.Initiative.Errors.NoExchangeTarget'));
    return false;
  }
  const selection = await YZEGSDialog.chooseActor(Object.fromEntries(candidates.map(entry => [
    entry.actor.uuid,
    `${entry.actor.name} — ${entry.initiative}`,
  ])));
  if (selection.cancelled) return false;
  const target = candidates.find(entry => entry.actor.uuid === selection.actor);
  if (!target) return false;
  const updates = [
    { _id: combatant.id, initiative: target.initiative },
    { _id: target.id, initiative: combatant.initiative },
  ];
  if (game.user.isGM) {
    await combat.updateEmbeddedDocuments('Combatant', updates, { yzegsInitiativeSwap: true });
  }
  else {
    game.socket.emit(INITIATIVE_SOCKET, {
      type: 'initiativeExchange',
      combatId: combat.id,
      actorUuid: actor.uuid,
      targetUuid: target.actor.uuid,
      responderId: game.user.id,
    });
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="yzegs chat-card"><p>${localize('YZEGS.Initiative.Exchanged', {
      actor: actor.name, target: target.actor.name,
    })}</p></div>`,
  });
  return true;
}

async function authorizeConflictUpdate(message, operation, payload, user) {
  const data = message?.getFlag(INITIATIVE_SYSTEM_ID, 'initiativeConflict');
  if (!data) return false;
  if (operation !== 'roll') return user?.isGM;
  const actorUuid = payload.side === 'attacker' ? data.leadAttackerUuid : data.leadTargetUuid;
  const rollMessage = game.messages.get(payload.rollMessageId);
  const roll = rollMessage?.rolls?.[0];
  return ownsActor(user, await resolveUuid(actorUuid))
    && roll?.options?.actorUuid === actorUuid
    && roll.options?.actionData?.declarationMessageId === message.id
    && Number(roll.baseSuccessQty) === Number(payload.successes)
    && (!payload.final || !roll.pushable);
}

async function applyExchangeRequest(payload, user) {
  const combat = game.combats.get(payload.combatId);
  const actor = await resolveUuid(payload.actorUuid);
  const target = await resolveUuid(payload.targetUuid);
  const combatant = combatantForActor(combat, actor);
  const targetCombatant = combatantForActor(combat, target);
  if (!combat || !ownsActor(user, actor) || combat.combatant?.id !== combatant?.id
    || Number(targetCombatant?.initiative) <= Number(combatant?.initiative)) return false;
  return combat.updateEmbeddedDocuments('Combatant', [
    { _id: combatant.id, initiative: targetCombatant.initiative },
    { _id: targetCombatant.id, initiative: combatant.initiative },
  ], { yzegsInitiativeSwap: true });
}

/** Reject duplicate or out-of-deck values created by Foundry's generic initiative controls. */
export function enforceUniqueInitiative(combatant, changes, options, userId) {
  if (userId !== game.user.id || options?.yzegsInitiativeSwap || !Object.hasOwn(changes, 'initiative')) return true;
  if (changes.initiative === null) return true;
  const value = Number(changes.initiative);
  const valid = Number.isInteger(value) && value >= 1 && value <= 10;
  const isDuplicate = [...(combatant.parent?.combatants ?? [])].some(entry => (
    entry.id !== combatant.id && Number(entry.initiative) === value
  ));
  if (valid && !isDuplicate) return true;
  ui.notifications.warn(localize(valid
    ? 'YZEGS.Initiative.Errors.DuplicateCard'
    : 'YZEGS.Initiative.Errors.InvalidCard'));
  return false;
}

export function registerInitiativeSocket() {
  game.socket.on(INITIATIVE_SOCKET, payload => {
    if (activeGM()?.id !== game.user.id) return;
    const user = game.users.get(payload.responderId);
    if (payload?.type === 'initiativeExchange') {
      applyExchangeRequest(payload, user).catch(error => console.error('yzegs | Initiative exchange failed.', error));
      return;
    }
    if (payload?.type !== 'initiativeConflict') return;
    const message = game.messages.get(payload.messageId);
    authorizeConflictUpdate(message, payload.operation, payload.payload, user).then(authorized => (
      authorized ? applyConflictUpdate(message, payload.operation, payload.payload) : false
    )).catch(error => console.error('yzegs | Ambush update failed.', error));
  });
}

function messageFromButton(button) {
  return game.messages.get(button.closest('.chat-message')?.dataset.messageId);
}

export async function handleInitiativeChatButton(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const message = messageFromButton(button);
    if (button.classList.contains('roll-initiative-attacker')) {
      return rollInitiativeConflictSide(message, 'attacker');
    }
    if (button.classList.contains('roll-initiative-target')) {
      return rollInitiativeConflictSide(message, 'target');
    }
    if (button.classList.contains('select-waylay-targets')) return selectWaylayTargets(message);
    if (button.classList.contains('apply-initiative-conflict')) return applyInitiativeConflict(message);
    return false;
  }
  finally { if (button.isConnected) button.disabled = false; }
}

/** Add GM workflow controls to the Combat Tracker without replacing Foundry's tracker. */
export function activateInitiativeTrackerControls(html) {
  if (!game.user.isGM || !html || html.querySelector('.yzegs-initiative-controls')) return;
  const anchor = html.querySelector('.combat-tracker-header, .encounter-controls, header');
  if (!anchor) return;
  const controls = document.createElement('div');
  controls.className = 'yzegs-initiative-controls flexrow';
  controls.innerHTML = `
    <button type="button" data-workflow="deal"><i class="fa-solid fa-cards"></i>
      ${localize('YZEGS.Initiative.Deal')}</button>
    <button type="button" data-workflow="surprise"><i class="fa-solid fa-bolt"></i>
      ${localize('YZEGS.Initiative.Surprise')}</button>
    <button type="button" data-workflow="ambush"><i class="fa-solid fa-person-rifle"></i>
      ${localize('YZEGS.Initiative.Ambush')}</button>
    <button type="button" data-workflow="waylay"><i class="fa-solid fa-person-shelter"></i>
      ${localize('YZEGS.Initiative.Waylay')}</button>`;
  controls.addEventListener('click', async event => {
    const button = event.target.closest('button[data-workflow]');
    if (!button) return;
    if (button.dataset.workflow === 'deal') await dealCombatInitiative();
    else if (button.dataset.workflow === 'ambush') await createAmbush();
    else if (button.dataset.workflow === 'waylay') await createWaylay();
    else if (button.dataset.workflow === 'surprise') {
      const actors = participantActors(canvas.tokens.controlled ?? []);
      if (actors.length !== 1) ui.notifications.warn(localize('YZEGS.Initiative.Errors.SelectOne'));
      else await assignSurpriseInitiative(actors[0]);
    }
  });
  anchor.insertAdjacentElement('afterend', controls);
}
