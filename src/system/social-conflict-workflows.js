import YZEGSDialog from '../components/dialog/dialog.js';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getActionSkillName, getActorActionSkill } from './action-skills.js';
import { getSkillCombatType } from './combat-modifiers.js';
import { resolveOpposedRoll } from './opposed-rolls.js';
import {
  calculateBarterPrice,
  calculateNegotiatingModifier,
  getSocialConflictConfig,
  NEGOTIATING_FACTORS,
  usesPlayerChoice,
} from './social-conflict.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const SOCIAL_CONFLICT_SOCKET = `system.${SYSTEM_ID}`;

async function resolveUuid(uuid) {
  if (!uuid) return null;
  try {
    // eslint-disable-next-line no-undef
    return await fromUuid(uuid);
  }
  catch (_error) { return null; }
}

function ownsActor(user, actor) {
  return Boolean(user && actor && (
    user.isGM || actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
  ));
}

function canUpdate(message) {
  return Boolean(message && (game.user.isGM || message.isAuthor));
}

function isResponsibleUpdater(message) {
  const activeGMs = [...game.users].filter(user => user.active && user.isGM)
    .sort((left, right) => left.id.localeCompare(right.id));
  const authorId = message?.author?.id ?? message?.user?.id ?? message?.user ?? '';
  if (authorId && game.users.get(authorId)?.active) return authorId === game.user.id;
  return activeGMs[0]?.id === game.user.id;
}

function responseLabel(response) {
  const key = response === 'counter'
    ? 'Counteroffer'
    : response[0].toUpperCase() + response.slice(1);
  return game.i18n.localize(`YZEGS.Social.${key}`);
}

function displayModifier(value) {
  value = Number(value) || 0;
  return value > 0 ? `+${value}` : String(value);
}

function resistanceAction(mode) {
  if (mode === 'interrogate') return { id: 'resistInterrogation', skill: 'stamina' };
  if (mode === 'barter') return { id: 'resistBarter', skill: 'persuasion' };
  return { id: 'resistPersuasion', skill: 'persuasion' };
}

function resolutionTargets(data) {
  if (data.activeSuccesses === null || data.activeSuccesses === undefined) return data.targets;
  return data.targets.map(target => ({
    ...target,
    ...resolveOpposedRoll({
      activeSuccesses: data.activeSuccesses,
      passiveSuccesses: target.successes,
    }),
  }));
}

function playerChoiceTargets(data) {
  return data.targets.map(target => ({
    ...target,
    responseLabel: target.response ? responseLabel(target.response) : '',
  }));
}

function renderContext(data) {
  const targets = data.playerChoice ? playerChoiceTargets(data) : resolutionTargets(data);
  const bestNet = Math.max(0, ...targets.map(target => Number(target.netSuccesses) || 0));
  const config = getSocialConflictConfig();
  let barterResult = '';
  if (data.mode === 'barter' && data.activeFinal && targets.some(target => target.won)) {
    barterResult = String(calculateBarterPrice({
      price: data.startingPrice,
      netSuccesses: bestNet,
      direction: data.direction,
      percentPerSuccess: config.barterPercentPerSuccess,
    }));
  }
  const showPreview = data.activeSuccesses !== null
    && !data.activeFinal
    && data.resistanceVisibility === 'public';
  return {
    ...data,
    targets,
    actorId: String(data.actorUuid).split('.').pop(),
    targetNames: targets.map(target => target.name).join(', '),
    primaryTargetUuid: targets[0]?.uuid ?? '',
    displayModifier: displayModifier(data.modifier),
    hideResistance: data.resistanceVisibility === 'gm',
    showResolution: Boolean(data.activeFinal || showPreview),
    provisionalResolution: showPreview,
    canRecordOutcome: data.activeFinal && !data.outcomeRecorded,
    barterResult,
    agreementLabel: data.agreementResponse ? responseLabel(data.agreementResponse) : '',
    actionSpend: data.combatAction?.tracked ? game.i18n.format('YZEGS.Social.ActionSpent', {
      action: data.combatAction.spentFromLabel
        ?? game.i18n.localize(`YZEGS.ActionTypes.${data.combatAction.spentFrom}`),
      fast: data.combatAction.remaining?.fast ?? 0,
      slow: data.combatAction.remaining?.slow ?? 0,
    }) : game.i18n.localize('YZEGS.CombatActions.OutOfCombat'),
  };
}

export async function renderSocialConflict(data) {
  return foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/chat/social-conflict-chat.hbs',
    { data: renderContext(data) },
  );
}

async function updateMessage(message, data) {
  return message.update({
    content: await renderSocialConflict(data),
    [`flags.${SYSTEM_ID}.socialConflict`]: data,
  });
}

function currentTargetActors(primary, activeActor) {
  const actors = new Map([[primary.uuid, primary]]);
  for (const token of game.user.targets ?? []) {
    if (
      ['character', 'npc'].includes(token.actor?.type)
      && token.actor.uuid !== activeActor.uuid
    ) actors.set(token.actor.uuid, token.actor);
  }
  return [...actors.values()];
}

/** Ask for declared stakes and all rules-facing options before an action is spent. */
export async function prepareSocialConflictSetup(actor, action, target) {
  const config = getSocialConflictConfig();
  const groupTargets = currentTargetActors(target, actor);
  let prior = {};
  let needsStakes = true;
  while (needsStakes) {
    const result = await YZEGSDialog.configureSocialConflict({
      actorName: actor.name,
      targetName: target.name,
      stakes: prior.stakes ?? '',
      offer: prior.offer ?? '',
      factors: NEGOTIATING_FACTORS.map(factor => ({
        ...factor,
        name: game.i18n.localize(factor.label),
        displayValue: factor.value > 0 ? `+${factor.value}` : factor.value,
      })),
      showGroupMode: groupTargets.length > 1,
      groupModes: {
        spokesperson: game.i18n.localize('YZEGS.Social.Spokesperson'),
        individual: game.i18n.localize('YZEGS.Social.IndividualTargets'),
      },
      resistanceVisibility: config.resistanceVisibility,
      visibilityModes: {
        public: game.i18n.localize('YZEGS.Social.Config.Public'),
        gm: game.i18n.localize('YZEGS.Social.Config.GMOnly'),
      },
      isBarter: action.id === 'barter',
      directions: {
        buy: game.i18n.localize('YZEGS.Social.Buying'),
        sell: game.i18n.localize('YZEGS.Social.Selling'),
      },
    });
    if (result.cancelled) return null;
    prior = result;
    needsStakes = !result.stakes;
    if (!needsStakes) {
      const targets = result.groupMode === 'individual' ? groupTargets : [target];
      return {
        ...result,
        modifier: calculateNegotiatingModifier(result.selectedFactors, result.customModifier),
        targets: targets.map(entry => ({ uuid: entry.uuid, name: entry.name, type: entry.type })),
      };
    }
    ui.notifications.warn(game.i18n.localize('YZEGS.Social.StakesRequired'));
  }
  return null;
}

/** Create the declaration card. The caller is responsible for spending the active action first. */
export async function createSocialConflict({ actor, action, setup, combatAction = null } = {}) {
  const config = getSocialConflictConfig();
  const targets = setup.targets.map(target => ({
    ...target,
    status: 'pending',
    successes: null,
    rollMessageId: '',
    response: '',
    responseDetails: '',
  }));
  const playerChoice = targets.every(target => usesPlayerChoice({
    targetType: target.type,
    mode: action.id,
    pcInfluenceMode: config.pcInfluenceMode,
  }));
  const data = {
    status: playerChoice ? 'awaitingChoice' : 'awaitingResistance',
    mode: action.id,
    actionName: game.i18n.localize(action.label),
    actorUuid: actor.uuid,
    actorName: actor.name,
    targets,
    stakes: setup.stakes,
    offer: setup.offer,
    selectedFactors: setup.selectedFactors,
    customModifier: setup.customModifier,
    modifier: setup.modifier,
    resistanceVisibility: setup.resistanceVisibility,
    startingPrice: setup.startingPrice,
    direction: setup.direction,
    activeOptionsPrepared: Boolean(setup.activeOptionsPrepared),
    playerChoice,
    combatAction,
    activeSuccesses: null,
    activeRollMessageId: '',
    activeFinal: false,
    response: '',
    responseDetails: '',
    recordedOutcome: '',
    outcomeRecorded: false,
    requestedReturn: '',
    agreementResponse: '',
    agreementDetails: '',
  };
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: await renderSocialConflict(data),
    flags: { [SYSTEM_ID]: { socialConflict: data } },
  });
}

async function submitUpdate(message, type, payload) {
  if (canUpdate(message)) return applyUpdate(message, type, payload);
  game.socket.emit(SOCIAL_CONFLICT_SOCKET, {
    type: 'socialConflict', messageId: message.id, operation: type, payload, responderId: game.user.id,
  });
  return true;
}

async function applyUpdate(message, type, payload) {
  const data = message.getFlag(SYSTEM_ID, 'socialConflict');
  if (!data) return false;
  if (type === 'resistance') {
    data.targets = data.targets.map(target => target.uuid === payload.targetUuid
      ? { ...target, status: 'rolled', successes: payload.successes, rollMessageId: payload.rollMessageId }
      : target);
    if (data.targets.every(target => target.status === 'rolled')) data.status = 'awaitingActive';
  }
  else if (type === 'active') {
    data.activeSuccesses = payload.successes;
    data.activeRollMessageId = payload.rollMessageId;
    data.activeFinal = Boolean(payload.final);
    data.status = data.activeFinal ? 'resolved' : 'activeRolled';
  }
  else if (type === 'playerResponse') {
    data.targets = data.targets.map(target => target.uuid === payload.targetUuid
      ? { ...target, status: 'responded', response: payload.response, responseDetails: payload.details ?? '' }
      : target);
    if (data.targets.every(target => target.status === 'responded')) {
      const counters = data.targets.filter(target => target.response === 'counter');
      data.requestedReturn = counters.map(target => `${target.name}: ${target.responseDetails}`).join('; ');
      data.status = counters.length ? 'agreementPending' : 'complete';
    }
  }
  else if (type === 'recordOutcome') {
    data.recordedOutcome = payload.outcome;
    data.requestedReturn = payload.requestedReturn;
    data.outcomeRecorded = true;
    data.status = payload.requestedReturn ? 'agreementPending' : 'complete';
  }
  else if (type === 'agreementResponse') {
    data.agreementResponse = payload.response;
    data.agreementDetails = payload.details ?? '';
    data.status = 'complete';
  }
  return updateMessage(message, data);
}

function rollSuccesses(result) {
  return Number(result?.rolls?.[0]?.baseSuccessQty ?? result?.baseSuccessQty) || 0;
}

export async function rollSocialResistance(message, targetUuid) {
  const data = message?.getFlag(SYSTEM_ID, 'socialConflict');
  const targetData = data?.targets?.find(entry => entry.uuid === targetUuid);
  const target = await resolveUuid(targetUuid);
  if (!data || !targetData || targetData.status !== 'pending' || !ownsActor(game.user, target)) return false;
  const resistance = resistanceAction(data.mode);
  const skill = getActorActionSkill(target, resistance.id, resistance.skill);
  if (!skill) {
    ui.notifications.warn(game.i18n.format('YZEGS.CombatActions.Errors.SkillMissing', {
      skill: getActionSkillName(resistance.id, resistance.skill),
    }));
    return false;
  }
  const result = await YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, target),
    title: game.i18n.format('YZEGS.Social.ResistanceRollTitle', { actor: target.name }),
    actor: target,
    combatType: getSkillCombatType(skill),
    maxPush: 0,
    lockMaxPush: true,
    askForOptions: !game.settings.get(SYSTEM_ID, 'showTaskCheckOptions'),
    hideCombatActions: true,
    messageMode: data.resistanceVisibility === 'gm' ? 'gm' : 'public',
    lockMessageMode: true,
    actionData: {
      workflow: 'socialResistance',
      actionId: resistance.id,
      modifierTargets: [resistance.id],
      declarationMessageId: message.id,
    },
  });
  if (!result) return false;
  return submitUpdate(message, 'resistance', {
    targetUuid, successes: rollSuccesses(result), rollMessageId: result.id ?? '',
  });
}

export async function rollSocialActive(message) {
  const data = message?.getFlag(SYSTEM_ID, 'socialConflict');
  const actor = await resolveUuid(data?.actorUuid);
  if (!data || data.status !== 'awaitingActive' || !ownsActor(game.user, actor)) return false;
  const skill = getActorActionSkill(actor, data.mode, 'persuasion');
  if (!skill) {
    ui.notifications.warn(game.i18n.format('YZEGS.CombatActions.Errors.SkillMissing', {
      skill: getActionSkillName(data.mode, 'persuasion'),
    }));
    return false;
  }
  const result = await YZEGSRoller.taskCheck({
    ...getAttributeAndSkill(skill, actor),
    title: `${data.actionName}: ${actor.name}`,
    actor,
    combatType: getSkillCombatType(skill),
    modifier: data.modifier,
    maxPush: 1,
    lockMaxPush: true,
    askForOptions: data.activeOptionsPrepared
      ? false
      : !game.settings.get(SYSTEM_ID, 'showTaskCheckOptions'),
    skipDialog: data.activeOptionsPrepared,
    hideCombatActions: true,
    actionData: {
      workflow: 'socialConflict',
      actionId: data.mode,
      modifierTargets: [data.mode],
      declarationMessageId: message.id,
    },
  });
  if (!result) return false;
  const roll = result.rolls?.[0];
  return submitUpdate(message, 'active', {
    successes: rollSuccesses(result), rollMessageId: result.id ?? '', final: !roll?.pushable,
  });
}

/** Synchronize the declaration after the active roll is pushed or accepted. */
export async function syncSocialConflictRoll(rollMessage, { final = false } = {}) {
  const roll = rollMessage?.rolls?.[0];
  const declarationId = roll?.options?.actionData?.declarationMessageId;
  const declaration = game.messages.get(declarationId);
  if (!declaration) return false;
  return submitUpdate(declaration, 'active', {
    successes: Number(roll.baseSuccessQty) || 0,
    rollMessageId: rollMessage.id,
    final: final || !roll.pushable,
  });
}

async function responseDetails(data, response, context = 'response') {
  if (response !== 'counter') return { details: '' };
  let result = {};
  while (!result.cancelled && !result.details) {
    result = await YZEGSDialog.socialResponse({
      title: game.i18n.localize('YZEGS.Social.Counteroffer'),
      label: game.i18n.localize('YZEGS.Social.CounterofferDetails'),
      stakes: data.stakes,
      offer: data.offer,
      details: '',
      context,
    }, game.i18n.localize('YZEGS.Social.Submit'));
    if (!result.cancelled && !result.details) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Social.CounterofferRequired'));
    }
  }
  return result;
}

export async function respondToSocialConflict(message, response, { agreement = false, targetUuid = '' } = {}) {
  const data = message?.getFlag(SYSTEM_ID, 'socialConflict');
  const responseTargetUuid = targetUuid || data?.targets?.[0]?.uuid;
  const actor = await resolveUuid(agreement ? data?.actorUuid : responseTargetUuid);
  if (!data || !ownsActor(game.user, actor)) return false;
  const details = await responseDetails(data, response, agreement ? 'agreement' : 'response');
  if (details.cancelled) return false;
  return submitUpdate(message, agreement ? 'agreementResponse' : 'playerResponse', {
    response, details: details.details, targetUuid: responseTargetUuid,
  });
}

export async function recordSocialOutcome(message) {
  const data = message?.getFlag(SYSTEM_ID, 'socialConflict');
  if (!data || !game.user.isGM || !data.activeFinal) return false;
  const result = await YZEGSDialog.socialResponse({
    title: game.i18n.localize('YZEGS.Social.RecordOutcome'),
    label: game.i18n.localize('YZEGS.Social.OutcomeDetails'),
    stakes: data.stakes,
    offer: data.offer,
    details: '',
  }, game.i18n.localize('YZEGS.Social.RecordOutcome'));
  if (result.cancelled) return false;
  let returnRequest = { details: '' };
  if (resolutionTargets(data).some(target => target.won)) {
    returnRequest = await YZEGSDialog.socialResponse({
      title: game.i18n.localize('YZEGS.Social.RequestReturnTitle'),
      label: game.i18n.localize('YZEGS.Social.RequestedReturn'),
      stakes: data.stakes,
      offer: data.offer,
      details: '',
    }, game.i18n.localize('YZEGS.Social.Save'));
    if (returnRequest.cancelled) return false;
  }
  return submitUpdate(message, 'recordOutcome', {
    outcome: result.details,
    requestedReturn: returnRequest.details,
  });
}

async function authorizeSocket(message, operation, payload, responder) {
  const data = message?.getFlag(SYSTEM_ID, 'socialConflict');
  if (!data) return false;
  if (operation === 'recordOutcome') return responder?.isGM && data.status === 'resolved';
  if (operation === 'active' || operation === 'agreementResponse') {
    if (!ownsActor(responder, await resolveUuid(data.actorUuid))) return false;
    if (operation === 'agreementResponse') return data.status === 'agreementPending';
    if (!['awaitingActive', 'activeRolled'].includes(data.status)) return false;
    const rollMessage = game.messages.get(payload.rollMessageId);
    const roll = rollMessage?.rolls?.[0];
    return Boolean(
      roll?.options?.actorUuid === data.actorUuid
      && roll.options?.actionData?.declarationMessageId === message.id
      && Number(roll.baseSuccessQty) === Number(payload.successes)
      && (!payload.final || !roll.pushable),
    );
  }
  if (operation === 'resistance') {
    const target = data.targets.find(entry => entry.uuid === payload.targetUuid);
    if (target?.status !== 'pending' || !ownsActor(responder, await resolveUuid(payload.targetUuid))) return false;
    const rollMessage = game.messages.get(payload.rollMessageId);
    const roll = rollMessage?.rolls?.[0];
    return Boolean(
      roll?.options?.actorUuid === payload.targetUuid
      && Number(roll.baseSuccessQty) === Number(payload.successes)
      && Number(roll.maxPush) === 0,
    );
  }
  if (operation === 'playerResponse') {
    const target = data.targets.find(entry => entry.uuid === payload.targetUuid);
    return data.status === 'awaitingChoice'
      && target?.status === 'pending'
      && ownsActor(responder, await resolveUuid(target.uuid));
  }
  return false;
}

export function registerSocialConflictSocket() {
  game.socket.on(SOCIAL_CONFLICT_SOCKET, payload => {
    if (payload?.type !== 'socialConflict') return;
    const message = game.messages.get(payload.messageId);
    if (!message || !isResponsibleUpdater(message)) return;
    const responder = game.users.get(payload.responderId);
    authorizeSocket(message, payload.operation, payload.payload, responder).then(authorized => {
      if (authorized) return applyUpdate(message, payload.operation, payload.payload);
      return false;
    }).catch(error => console.error('yzegs | Social conflict socket update failed.', error));
  });
}
