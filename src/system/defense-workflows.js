import { resolveBlock } from './defense.js';

export const DEFENSE_SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const DEFENSE_SOCKET = `system.${DEFENSE_SYSTEM_ID}`;

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

function messageAuthorId(message) {
  return message?.author?.id ?? message?.user?.id ?? message?.user ?? '';
}

function isResponsibleUpdater(message, { preferGM = false } = {}) {
  const activeGMs = [...game.users].filter(user => user.active && user.isGM).sort((a, b) => a.id.localeCompare(b.id));
  if (preferGM && activeGMs.length) return activeGMs[0].id === game.user.id;
  const authorId = messageAuthorId(message);
  if (authorId && game.users.get(authorId)?.active) return game.user.id === authorId;
  return activeGMs[0]?.id === game.user.id;
}

function canUpdate(message) {
  return Boolean(message && (game.user.isGM || message.isAuthor));
}

function ownsActor(user, actor) {
  return Boolean(user && actor && (user.isGM || actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)));
}

export async function renderDefenseDeclaration(data) {
  return foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/chat/defense-declaration-chat.hbs',
    { data },
  );
}

async function updateDeclarationMessage(message, data) {
  const content = await renderDefenseDeclaration(data);
  return message.update({
    content,
    [`flags.${DEFENSE_SYSTEM_ID}.defenseDeclaration`]: data,
  });
}

/** Create the pre-roll declaration required by the close-combat Blocking rules. */
export async function createCloseAttackDeclaration({
  attacker,
  defender,
  item = null,
  actionId,
  selection = {},
} = {}) {
  const data = {
    status: 'pending',
    response: '',
    attackerUuid: attacker.uuid,
    attackerName: attacker.name,
    defenderUuid: defender.uuid,
    defenderName: defender.name,
    itemUuid: item?.uuid ?? '',
    itemName: item?.name ?? '',
    actionId,
    selection: {
      actionId: selection.actionId ?? actionId,
      targetUuid: selection.targetUuid ?? defender.uuid,
      itemId: selection.itemId ?? item?.id ?? '',
    },
  };
  const content = await renderDefenseDeclaration(data);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content,
    flags: { [DEFENSE_SYSTEM_ID]: { defenseDeclaration: data } },
  });
}

/** Record the defender's response, using the message author as a socket proxy when required. */
export async function submitDefenseDeclaration(message, response) {
  if (!message) return false;
  if (canUpdate(message)) {
    const data = message.getFlag(DEFENSE_SYSTEM_ID, 'defenseDeclaration');
    if (!data || data.status !== 'pending') return false;
    await updateDeclarationMessage(message, { ...data, ...response, status: 'responded' });
    return true;
  }
  game.socket.emit(DEFENSE_SOCKET, {
    type: 'defenseDeclaration',
    messageId: message.id,
    response,
    responderId: game.user.id,
  });
  return true;
}

/** Mark a declaration as resolved once its linked attack roll has been created. */
export async function completeDefenseDeclaration(message, attackMessage) {
  const data = message?.getFlag(DEFENSE_SYSTEM_ID, 'defenseDeclaration');
  if (!data || !canUpdate(message)) return false;
  await updateDeclarationMessage(message, {
    ...data,
    status: 'completed',
    attackMessageId: attackMessage?.id ?? '',
  });
  return true;
}

async function updateAttackWithBlock(attackMessage, blockMessage) {
  const attackRoll = attackMessage?.rolls?.[0];
  const blockRoll = blockMessage?.rolls?.[0];
  const defense = attackRoll?.options?.defense;
  if (!attackRoll || !blockRoll || defense?.status !== 'awaitingBlockRoll') return false;
  if (blockRoll.options?.defenseFor?.attackMessageId !== attackMessage.id) return false;
  if (
    blockRoll.options?.actorUuid !== defense.defenderUuid
    || blockRoll.options?.actionData?.actionId !== 'block'
  ) return false;

  const resolution = resolveBlock({
    attackSuccesses: attackRoll.baseSuccessQty,
    blockSuccesses: blockRoll.baseSuccessQty,
  });
  attackRoll.options.defense = {
    ...defense,
    status: 'resolved',
    blockMessageId: blockMessage.id,
    ...resolution,
  };
  const content = await attackRoll.render();
  await attackMessage.update({ content, rolls: [JSON.stringify(attackRoll)] });
  return true;
}

/** Apply a finalized Block roll to its attack, proxying the update when the defender is not the attack author. */
export async function submitBlockResolution(attackMessage, blockMessage) {
  if (!attackMessage || !blockMessage) return false;
  if (canUpdate(attackMessage)) return updateAttackWithBlock(attackMessage, blockMessage);
  game.socket.emit(DEFENSE_SOCKET, {
    type: 'blockResolution',
    attackMessageId: attackMessage.id,
    blockMessageId: blockMessage.id,
    responderId: game.user.id,
  });
  return true;
}

async function handleDefenseDeclarationSocket(payload) {
  const message = game.messages.get(payload.messageId);
  if (!message || !isResponsibleUpdater(message)) return;
  const data = message.getFlag(DEFENSE_SYSTEM_ID, 'defenseDeclaration');
  const defender = await resolveUuid(data?.defenderUuid);
  const responder = game.users.get(payload.responderId);
  if (!data || data.status !== 'pending' || !ownsActor(responder, defender)) return;
  if (payload.response?.response === 'block' && payload.response.blockItemUuid) {
    const blockItem = await resolveUuid(payload.response.blockItemUuid);
    if (
      blockItem?.type !== 'weapon'
      || blockItem.actor?.uuid !== defender.uuid
      || !blockItem.system.equipped
    ) return;
  }
  await updateDeclarationMessage(message, { ...data, ...payload.response, status: 'responded' });
}

async function handleBlockResolutionSocket(payload) {
  const attackMessage = game.messages.get(payload.attackMessageId);
  const blockMessage = game.messages.get(payload.blockMessageId);
  if (!attackMessage || !blockMessage || !isResponsibleUpdater(attackMessage, { preferGM: true })) return;
  const defender = await resolveUuid(attackMessage.rolls?.[0]?.options?.defense?.defenderUuid);
  const responder = game.users.get(payload.responderId);
  if (!ownsActor(responder, defender)) return;
  await updateAttackWithBlock(attackMessage, blockMessage);
}

/** Register the cross-client message updates used by attacker and defender owners. */
export function registerDefenseSocket() {
  game.socket.on(DEFENSE_SOCKET, payload => {
    let handler = null;
    if (payload?.type === 'defenseDeclaration') handler = handleDefenseDeclarationSocket;
    else if (payload?.type === 'blockResolution') handler = handleBlockResolutionSocket;
    if (handler) handler(payload).catch(error => console.error('yzegs | Defense socket update failed.', error));
  });
}
