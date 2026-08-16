/* eslint-disable no-unused-vars */
import ActorYZEGS from '../../actor/actor.js';
import ItemYZEGS from '../../item/item.js';
import YZEGSDialog from '../dialog/dialog.js';
import { getAttributeAndSkill, getRollingActor, rollPush, YZEGSRoller } from '../roll/dice.js';
import { YZEGS } from '../../system/config.js';
import { getEffectiveWeaponProfile } from '../../system/weapon-profile.js';
import {
  applyRollPushCosts,
  getPushCostMode,
  PUSH_COST_MODES,
  resolvePushCostDocuments,
  SYSTEM_ID,
} from '../../system/push-costs.js';
import { applyTwilightActionOutcome } from '../../system/twilight-action-workflows.js';
import { resolveDamageAllocation } from '../../system/damage-allocation.js';
import {
  coverAppliesAgainst,
  coverProtectsLocation,
  getEffectiveAttackSuccesses,
} from '../../system/defense.js';
import { resolveCombatActionSpend } from '../../system/combat-actions.js';
import { getSkillCombatType } from '../../system/combat-modifiers.js';
import { getActionSkillName, getActorActionSkill } from '../../system/action-skills.js';
import { isActorInActiveCombat } from '../../system/reloading.js';
import {
  completeDefenseDeclaration,
  submitBlockResolution,
  submitDefenseDeclaration,
} from '../../system/defense-workflows.js';
import {
  addSuppressionTarget,
  assignSuppressionTarget,
  rollSuppressionCheck,
} from '../../system/suppression-workflows.js';
import { resolveBlastTargets } from '../../system/blast-workflows.js';
import {
  applyCollapse,
  applyRicochetHit,
  resolveCollapse,
  resolveRicochet,
} from '../../system/confined-space-workflows.js';
import {
  applyMinefieldDirectDamage,
  resolveMinefieldBlast,
  resolveMinefieldCollapse,
} from '../../system/minefield-workflows.js';
import { evadeGuidedImpact, scheduleGuidedImpact } from '../../system/guided-weapons.js';
import {
  recordSocialOutcome,
  respondToSocialConflict,
  rollSocialActive,
  rollSocialResistance,
  syncSocialConflictRoll,
} from '../../system/social-conflict-workflows.js';

export default class ChatMessageYZEGS extends foundry.documents.ChatMessage {
  prepareData() {
    super.prepareData();
  }

  /** 
 * Adds Event Listeners to the Chat log.
 * @param {HTMLElement} html The DOM
 */
  static addChatListeners(html) {
    ActorYZEGS.chatListeners(html);
    ItemYZEGS.chatListeners(html);

    const buttonsPush = html.querySelectorAll('.dice-button.push');
    for (let i = 0; i < buttonsPush.length; i++) {
      buttonsPush[i].addEventListener('click', _onRollPush);
    }
    const buttonsApply = html.querySelectorAll('.dice-button.accept');
    for (let i = 0; i < buttonsApply.length; i++) {
      buttonsApply[i].addEventListener('click', _onRollAccept);
    }
    const buttonsPushCosts = html.querySelectorAll('.dice-button.apply-push-costs');
    for (let i = 0; i < buttonsPushCosts.length; i++) {
      buttonsPushCosts[i].addEventListener('click', _onApplyPushCosts);
    }
    const buttonsApplyDamage = html.querySelectorAll('.dice-button.apply-damage');
    for (let i = 0; i < buttonsApplyDamage.length; i++) {
      buttonsApplyDamage[i].addEventListener('click', _onApplyDamage);
    }
    const buttonsApplyAction = html.querySelectorAll('.dice-button.apply-action-outcome');
    for (let i = 0; i < buttonsApplyAction.length; i++) {
      buttonsApplyAction[i].addEventListener('click', _onApplyActionOutcome);
    }
    for (const button of html.querySelectorAll('.dice-button.declare-block')) {
      button.addEventListener('click', _onDeclareBlock);
    }
    for (const button of html.querySelectorAll('.dice-button.decline-block')) {
      button.addEventListener('click', _onDeclineBlock);
    }
    for (const button of html.querySelectorAll('.dice-button.continue-declared-attack')) {
      button.addEventListener('click', _onContinueDeclaredAttack);
    }
    for (const button of html.querySelectorAll('.dice-button.roll-block')) {
      button.addEventListener('click', _onRollBlock);
    }
    for (const button of html.querySelectorAll('.dice-button.apply-block')) {
      button.addEventListener('click', _onApplyBlock);
    }
    for (const button of html.querySelectorAll('.dice-button.roll-suppression')) {
      button.addEventListener('click', _onRollSuppression);
    }
    for (const button of html.querySelectorAll('.dice-button.assign-suppression')) {
      button.addEventListener('click', _onAssignSuppression);
    }
    for (const button of html.querySelectorAll('.dice-button.resolve-blast')) {
      button.addEventListener('click', _onResolveBlast);
    }
    for (const button of html.querySelectorAll('.dice-button.resolve-ricochet')) {
      button.addEventListener('click', _onResolveRicochet);
    }
    for (const button of html.querySelectorAll('.dice-button.apply-ricochet-hit')) {
      button.addEventListener('click', _onApplyRicochetHit);
    }
    for (const button of html.querySelectorAll('.dice-button.resolve-collapse')) {
      button.addEventListener('click', _onResolveCollapse);
    }
    for (const button of html.querySelectorAll('.dice-button.apply-collapse')) {
      button.addEventListener('click', _onApplyCollapse);
    }
    for (const button of html.querySelectorAll('.dice-button.apply-minefield-direct')) {
      button.addEventListener('click', _onApplyMinefieldDirectDamage);
    }
    for (const button of html.querySelectorAll('.dice-button.resolve-minefield-blast')) {
      button.addEventListener('click', _onResolveMinefieldBlast);
    }
    for (const button of html.querySelectorAll('.dice-button.resolve-minefield-collapse')) {
      button.addEventListener('click', _onResolveMinefieldCollapse);
    }
    for (const button of html.querySelectorAll('.dice-button.schedule-guided-impact')) {
      button.addEventListener('click', _onScheduleGuidedImpact);
    }
    for (const button of html.querySelectorAll('.dice-button.evade-guided-impact')) {
      button.addEventListener('click', _onEvadeGuidedImpact);
    }
    for (const button of html.querySelectorAll('.dice-button.roll-social-resistance')) {
      button.addEventListener('click', _onRollSocialResistance);
    }
    for (const button of html.querySelectorAll('.dice-button.roll-social-active')) {
      button.addEventListener('click', _onRollSocialActive);
    }
    for (const button of html.querySelectorAll('.dice-button.social-player-response')) {
      button.addEventListener('click', _onSocialPlayerResponse);
    }
    for (const button of html.querySelectorAll('.dice-button.record-social-outcome')) {
      button.addEventListener('click', _onRecordSocialOutcome);
    }
    for (const button of html.querySelectorAll('.dice-button.social-agreement-response')) {
      button.addEventListener('click', _onSocialAgreementResponse);
    }
  }

  /* ------------------------------------------- */
  /*  Hiding Buttons                             */
  /* ------------------------------------------- */

  /**
 * Hides buttons of Chat messages for non-owners.
 * @param {HTMLElement} html DOM
 */
  static hideChatActionButtons(html) {
    // const button = html.querySelectorAll('.card-buttons button');
    const chatCard = html.querySelectorAll('.yzegs.chat-card');

    // Exits early if no chatCard were found.
    if (chatCard.length <= 0) return;
    // Hides buttons.
    chatCard.forEach(card =>{
      const actor = game.actors.get(card.dataset.actorId);
      const buttons = card.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.dataset.gmOnly && !game.user.isGM) {
          btn.style.display = 'none';
          continue;
        }
        const ownerUuid = btn.dataset.ownerUuid;
        if (ownerUuid) {
          let owner = null;
          try {
            // eslint-disable-next-line no-undef
            owner = fromUuidSync(ownerUuid);
          }
          catch (_error) { /* A stale defense card simply has no available action. */ }
          if (!game.user.isGM && !owner?.isOwner) btn.style.display = 'none';
        }
        else if (actor && !actor.isOwner) btn.style.display = 'none';
      }
    });
  }

}

async function _onScheduleGuidedImpact(event) {
  event.preventDefault();
  const message = game.messages.get(event.currentTarget.closest('.chat-message')?.dataset.messageId);
  await scheduleGuidedImpact(message);
}

async function _onEvadeGuidedImpact(event) {
  event.preventDefault();
  const message = game.messages.get(event.currentTarget.closest('.chat-message')?.dataset.messageId);
  await evadeGuidedImpact(message);
}

async function runConfinedButton(button, callback) {
  button.disabled = true;
  try {
    return await callback(getMessageFromButton(button));
  }
  catch (error) {
    console.error('yzegs | Confined-space resolution failed.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.ConfinedSpace.Failed'));
    return false;
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

function _onResolveRicochet(event) {
  event.preventDefault();
  return runConfinedButton(event.currentTarget, resolveRicochet);
}

function _onApplyRicochetHit(event) {
  event.preventDefault();
  const index = Number(event.currentTarget.dataset.hitIndex);
  return runConfinedButton(event.currentTarget, message => applyRicochetHit(message, index));
}

function _onResolveCollapse(event) {
  event.preventDefault();
  return runConfinedButton(event.currentTarget, resolveCollapse);
}

function _onApplyCollapse(event) {
  event.preventDefault();
  return runConfinedButton(event.currentTarget, message => applyCollapse(message, game.user.targets));
}

function _onApplyMinefieldDirectDamage(event) {
  event.preventDefault();
  return runConfinedButton(event.currentTarget, applyMinefieldDirectDamage);
}

function _onResolveMinefieldBlast(event) {
  event.preventDefault();
  if (!game.user.targets.size) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Urban.Blast.SelectTargets'));
    return false;
  }
  return runConfinedButton(event.currentTarget, message => resolveMinefieldBlast(message, game.user.targets));
}

function _onResolveMinefieldCollapse(event) {
  event.preventDefault();
  return runConfinedButton(event.currentTarget, resolveMinefieldCollapse);
}

async function _onResolveBlast(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (!game.user.targets.size) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Urban.Blast.SelectTargets'));
      return;
    }
    const message = getMessageFromButton(button);
    await resolveBlastTargets(message?.rolls?.[0], game.user.targets);
  }
  catch (error) {
    console.error('yzegs | Failed to resolve blast.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.Urban.Blast.Failed'));
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function _onRollSuppression(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const message = getMessageFromButton(button);
    const completed = await rollSuppressionCheck(message, button.dataset.targetUuid);
    if (completed === false && button.isConnected) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Suppression.RollFailed'));
    }
  }
  catch (error) {
    console.error('yzegs | Failed to resolve suppression.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.Suppression.RollFailed'));
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function _onAssignSuppression(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (game.user.targets.size !== 1) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Suppression.SelectSingleTarget'));
      return;
    }
    const message = getMessageFromButton(button);
    const assigned = await assignSuppressionTarget(message, [...game.user.targets][0]);
    if (!assigned) ui.notifications.warn(game.i18n.localize('YZEGS.Suppression.AssignFailed'));
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
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

function getMessageFromButton(button) {
  const element = button.closest('.chat-message');
  return game.messages.get(element?.dataset.messageId);
}

async function _onDeclareBlock(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  let submitted = false;
  try {
    const message = getMessageFromButton(button);
    const declaration = message?.getFlag(SYSTEM_ID, 'defenseDeclaration');
    const defender = await resolveUuid(declaration?.defenderUuid);
    if (!message || !declaration || !defender || (!game.user.isGM && !defender.isOwner)) return;

    const choices = [...defender.items].filter(item => (
      item.type === 'weapon' && item.system.equipped
    )).map(item => ({ value: item.uuid, label: item.name }));
    const method = await YZEGSDialog.chooseBlockMethod({ choices });
    if (method.cancelled) return;
    const blockItem = method.itemUuid ? await resolveUuid(method.itemUuid) : null;
    if (method.itemUuid && (
      blockItem?.type !== 'weapon'
      || blockItem.actor?.uuid !== defender.uuid
      || !blockItem.system.equipped
    )) return;

    const spend = resolveCombatActionSpend({
      inCombat: isActorInActiveCombat(defender, game.combat),
      speed: 'fast',
      fast: defender.system.actions?.fast?.value,
      slow: defender.system.actions?.slow?.value,
    });
    if (!spend.available) {
      ui.notifications.warn(game.i18n.localize('YZEGS.CombatActions.NoFastAction'));
      return;
    }
    if (spend.tracked) {
      await defender.update({
        [`system.actions.${spend.spentFrom}.value`]: spend.remaining[spend.spentFrom],
      });
    }
    await submitDefenseDeclaration(message, {
      response: 'block',
      blockItemUuid: blockItem?.uuid ?? '',
      blockItemName: blockItem?.name ?? game.i18n.localize('YZEGS.Defense.Unarmed'),
      spentFrom: spend.spentFrom ?? '',
      remaining: spend.remaining,
    });
    submitted = true;
  }
  finally {
    if (!submitted && button.isConnected) button.disabled = false;
  }
}

async function _onDeclineBlock(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  let submitted = false;
  try {
    const message = getMessageFromButton(button);
    const declaration = message?.getFlag(SYSTEM_ID, 'defenseDeclaration');
    const defender = await resolveUuid(declaration?.defenderUuid);
    if (!message || !defender || (!game.user.isGM && !defender.isOwner)) return;
    await submitDefenseDeclaration(message, { response: 'decline' });
    submitted = true;
  }
  finally {
    if (!submitted && button.isConnected) button.disabled = false;
  }
}

async function _onContinueDeclaredAttack(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const message = getMessageFromButton(button);
    const declaration = message?.getFlag(SYSTEM_ID, 'defenseDeclaration');
    const attacker = await resolveUuid(declaration?.attackerUuid);
    const item = await resolveUuid(declaration?.itemUuid);
    if (!message || declaration?.status !== 'responded' || !attacker) return;
    if (!game.user.isGM && !attacker.isOwner) return;
    const defense = {
      status: declaration.response === 'block' ? 'awaitingBlockRoll' : 'declined',
      declared: declaration.response === 'block',
      defenderUuid: declaration.defenderUuid,
      defenderName: declaration.defenderName,
      blockItemUuid: declaration.blockItemUuid ?? '',
      blockItemName: declaration.blockItemName ?? '',
      declarationMessageId: message.id,
    };
    let attackMessage;
    if (item) {
      attackMessage = await item.rollAttack({
        skipDefenseDeclaration: true,
        defense,
        messageMode: 'public',
      }, attacker);
    }
    else {
      const { executeTwilightAction } = await import('../../system/twilight-action-workflows.js');
      attackMessage = await executeTwilightAction(attacker, {
        ...declaration.selection,
        skipDefenseDeclaration: true,
        defense,
        messageMode: 'public',
      });
    }
    if (attackMessage) await completeDefenseDeclaration(message, attackMessage);
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function _onRollBlock(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const attackMessage = getMessageFromButton(button);
    const attackRoll = attackMessage?.rolls?.[0];
    const defense = attackRoll?.options?.defense;
    const defender = await resolveUuid(defense?.defenderUuid);
    const blockItem = await resolveUuid(defense?.blockItemUuid);
    if (!attackMessage || defense?.status !== 'awaitingBlockRoll' || !defender) return;
    if (!game.user.isGM && !defender.isOwner) return;
    const skill = getActorActionSkill(defender, 'block', 'closeCombat');
    if (!skill) {
      ui.notifications.warn(game.i18n.format('YZEGS.CombatActions.Errors.SkillMissing', {
        skill: getActionSkillName('block', 'closeCombat'),
      }));
      return;
    }
    const stats = getAttributeAndSkill(skill, defender);
    await YZEGSRoller.taskCheck({
      ...stats,
      title: game.i18n.format('YZEGS.Defense.BlockRollTitle', { defender: defender.name }),
      actor: defender,
      item: blockItem,
      combatType: getSkillCombatType(skill),
      hideCombatActions: true,
      messageMode: 'public',
      actionData: {
        actionId: 'block',
        modifierTargets: ['block', 'close-block'],
        label: game.i18n.localize('YZEGS.ActionNames.block'),
        actorUuid: defender.uuid,
        targetUuid: attackRoll.options.actorUuid ?? '',
        canApplyOutcome: false,
        applied: false,
      },
      defenseFor: { attackMessageId: attackMessage.id },
    });
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function _onApplyBlock(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const blockMessage = getMessageFromButton(button);
    const blockRoll = blockMessage?.rolls?.[0];
    const attackMessage = game.messages.get(blockRoll?.options?.defenseFor?.attackMessageId);
    if (!blockMessage || !attackMessage || blockRoll.pushable) return;
    await submitBlockResolution(attackMessage, blockMessage);
    blockRoll.options.defenseFor.applied = true;
    const content = await blockRoll.render();
    await blockMessage.update({ content, rolls: [JSON.stringify(blockRoll)] });
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function _onApplyActionOutcome(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const chatCard = button.closest('.chat-message');
    const message = game.messages.get(chatCard?.dataset.messageId);
    const roll = message?.rolls[0];
    if (!message || !roll) return;
    const applied = await applyTwilightActionOutcome(roll);
    if (!applied) return;
    const content = await roll.render();
    await message.update({ content, rolls: [JSON.stringify(roll)] });
    ui.notifications.info(game.i18n.localize('YZEGS.CombatActions.OutcomeApplied'));
  }
  catch (error) {
    console.error('yzegs | Failed to apply action outcome.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.CombatActions.Errors.ApplyFailed'));
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

/* ------------------------------------------- */
/*  Apply Damage Button                        */
/* ------------------------------------------- */

async function _onApplyDamage(event) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;

  try {
    const message = getMessageFromButton(button);
    const roll = message?.rolls?.[0];
    const hasLinkedPrimaryTarget = Boolean(
      roll?.options?.defense?.defenderUuid
      && !roll.options.damageApplication?.primaryApplied,
    );
    if (!game.user.targets.size && !hasLinkedPrimaryTarget) {
      ui.notifications.warn(game.i18n.localize('YZEGS.Combat.SelectDamageTarget'));
      return;
    }
    const messageElem = button.closest('.chat-message');
    if (messageElem) await _applyDamage(messageElem);
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

/* ------------------------------------------- */
/*  Roll Push                                  */
/* ------------------------------------------- */

/**
 * Triggers a push from the chat.
 * @param {Event} event
 * @returns {Promise<import('../lib/yzur.js').YearZeroRoll|ChatMessage>}
 */
async function _onRollPush(event) {
  event.preventDefault();

  // Disables the button to avoid any tricky double push.
  const button = event.currentTarget;
  button.disabled = true;

  // Gets infos and requires a push.
  const chatCard = event.currentTarget.closest('.chat-message');
  const messageId = chatCard.dataset.messageId;
  const message = game.messages.get(messageId);
  const roll = message.rolls[0];
  const result = await rollPush(roll, { message });
  if (result?.rolls?.[0]?.options?.actionData?.workflow === 'socialConflict') {
    await syncSocialConflictRoll(result);
  }
  return result;
}

/* ------------------------------------------- */
/*  Roll Accept                                */
/* ------------------------------------------- */

/**
 * Accepts a roll in the chat.
 * @param {Event} event
 * @returns {Promise<import('../lib/yzur.js').YearZeroRoll|ChatMessage>}
 */
async function _onRollAccept(event) {
  event.preventDefault();

  // Disables the button to avoid any tricky double push.
  const button = event.currentTarget;
  button.disabled = true;

  // Gets infos and requires a push.
  const chatCard = event.currentTarget.closest('.chat-message');
  const messageId = chatCard.dataset.messageId;
  const message = game.messages.get(messageId);
  /** @type {import('yzur').YearZeroRoll} */
  const roll = message.rolls[0];
  roll.maxPush = 0;
  const content = await roll.render();
  const result = await message.update({ content, rolls: [JSON.stringify(roll)] });
  if (roll.options?.actionData?.workflow === 'socialConflict') {
    await syncSocialConflictRoll(message, { final: true });
  }
  return result;
}

function getSocialMessage(event) {
  return game.messages.get(event.currentTarget.closest('.chat-message')?.dataset.messageId);
}

async function runSocialButton(event, callback) {
  event.preventDefault();
  const button = event.currentTarget;
  button.disabled = true;
  try { return await callback(getSocialMessage(event), button); }
  catch (error) {
    console.error('yzegs | Social conflict action failed.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.Social.Failed'));
    return false;
  }
  finally { if (button.isConnected) button.disabled = false; }
}

function _onRollSocialResistance(event) {
  return runSocialButton(event, (message, button) => rollSocialResistance(message, button.dataset.targetUuid));
}

function _onRollSocialActive(event) {
  return runSocialButton(event, message => rollSocialActive(message));
}

function _onSocialPlayerResponse(event) {
  return runSocialButton(event, (message, button) => respondToSocialConflict(message, button.dataset.response, {
    targetUuid: button.dataset.targetUuid,
  }));
}

function _onRecordSocialOutcome(event) {
  return runSocialButton(event, message => recordSocialOutcome(message));
}

function _onSocialAgreementResponse(event) {
  return runSocialButton(event, (message, button) => (
    respondToSocialConflict(message, button.dataset.response, { agreement: true })
  ));
}

/* ------------------------------------------- */
/*  Push Costs                                 */
/* ------------------------------------------- */

/** Apply a pushed roll's Damage, Stress, and/or Reliability cost. */
async function _onApplyPushCosts(event) {
  event.preventDefault();

  const button = event.currentTarget;
  button.disabled = true;

  try {
    if (getPushCostMode() !== PUSH_COST_MODES.BUTTON) return;

    const chatCard = button.closest('.chat-message');
    const message = game.messages.get(chatCard.dataset.messageId);
    const roll = message?.rolls[0];
    if (!message || !roll) return;

    const flags = message.getFlag(SYSTEM_ID, 'data') ?? {};
    const { actor, item } = resolvePushCostDocuments(roll);
    const result = await applyRollPushCosts(roll, { flags, actor, item });
    if (!result.applied) {
      ui.notifications.warn(game.i18n.localize('YZEGS.PushCosts.Notifications.NothingToApply'));
      return;
    }

    await message.setFlag(SYSTEM_ID, 'data', result.flags);
    const content = await roll.render();
    await message.update({ content, rolls: [JSON.stringify(roll)] });
  }
  catch (error) {
    console.error('yzegs | Failed to apply pushed roll costs.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.PushCosts.Notifications.Failed'));
    if (button.isConnected) button.disabled = false;
  }
}

/* ------------------------------------------- */
/*  Utility Methods                            */
/* ------------------------------------------- */

/**
 * Gets the Actor which is the source of a chat card.
 * @param {HTMLElement} card The card being used
 * @return {Actor}
 */
export function getChatCardActor(card) {
  // Case 1 — A Synthetic Actor from a Token
  const tokenKey = card.dataset.tokenId;
  if (tokenKey) {
    const [sceneId, tokenId] = tokenKey.split('.');
    const scene = game.scenes.get(sceneId);
    if (!scene) return null;
    const token = scene.getEmbeddedDocument('Token', tokenId);
    // if (!tokenData) return null;
    // const token = new Token(tokenData);
    return token.actor;
  }

  // Case 2 — Use Actor ID instead
  const actorId = card.dataset.actorId;
  return game.actors.get(actorId);
}

async function _applyDamage(messageElem) {
  const messageId = messageElem.dataset.messageId;
  const message = game.messages.get(messageId);
  /** @type {import('../lib/yzur.js').YearZeroRoll} */
  const roll = message.rolls[0];

  // Gets the weapon.
  const actorId = roll.options.actorId;
  const tokenKey = roll.options.tokenKey;
  const actor = getRollingActor({ actorId, tokenKey });
  const itemId = roll.options.itemId;
  const item = actor ? actor.items.get(itemId) : game.items.get(itemId);
  // Use the profile captured when the attack was rolled. The fallback keeps old chat
  // messages usable, but only those legacy rolls need to inspect the currently loaded ammo.
  const attackSnapshot = roll.options.attackData;
  if (!attackSnapshot && !item) {
    return ui.notifications.warn(game.i18n.localize('YZEGS.Chat.Roll.NoItemNotif'));
  }
  const loadedAmmunition = actor && item?.hasAmmo
    ? actor.items.get(item.system.mag.target)
    : null;
  const attackData = foundry.utils.deepClone(
    attackSnapshot ?? getEffectiveWeaponProfile(item, loadedAmmunition),
  );
  const loc = roll.bestHitLocation;
  if (loc > 0) attackData.location = YZEGS.hitLocs[loc - 1];

  const state = roll.options.damageApplication ?? {
    primaryApplied: false,
    ammoSuccessesRemaining: roll.hitCount,
    complete: false,
  };
  if (state.complete) return;

  // Every hit resolves against one target and one hit location. Additional
  // ammo-die hits can be assigned to a different currently targeted token by
  // retargeting before pressing the chat-card button again.
  let defenders = [...game.user.targets];
  if (!state.primaryApplied && attackData.primaryTargetUuid) {
    const linkedTarget = await resolveUuid(attackData.primaryTargetUuid);
    const linkedActor = linkedTarget?.actor ?? linkedTarget;
    if (linkedActor) defenders = [{ actor: linkedActor, name: linkedActor.name }];
  }
  if (!state.primaryApplied && roll.options.defense?.defenderUuid) {
    const linkedDefender = await resolveUuid(roll.options.defense.defenderUuid);
    if (linkedDefender) {
      const defenderActor = linkedDefender.actor ?? linkedDefender;
      defenders = [{ actor: defenderActor, name: defenderActor.name }];
    }
  }
  if (defenders.length !== 1) {
    return ui.notifications.warn(game.i18n.localize('YZEGS.Combat.SelectSingleDamageTarget'));
  }
  const defender = defenders[0];
  addSuppressionTarget(roll, defender.actor, defender.document ?? defender, {
    cause: 'fire',
    sourceName: actor?.name ?? '',
  });

  const primary = !state.primaryApplied;
  const ammoSuccesses = Math.max(0, Number(state.ammoSuccessesRemaining) || 0);
  const defaultAmmoSpend = primary ? ammoSuccesses : Math.min(1, ammoSuccesses);
  const effectiveSuccesses = getEffectiveAttackSuccesses(roll);
  const preview = resolveDamageAllocation({
    baseDamage: attackData.damage,
    baseSuccesses: effectiveSuccesses,
    ammoSuccesses,
    primaryApplied: state.primaryApplied,
    ammoSpend: defaultAmmoSpend,
  });
  if (!preview.available) return;

  const storedCover = defender.actor.coverDetails;
  const attackSourceUuid = attackData.sourceActorUuid || actor?.uuid || '';
  const cover = coverAppliesAgainst(storedCover, attackSourceUuid) ? storedCover : null;
  attackData.cover = cover?.type ?? null;
  const barrier = (!primary || coverProtectsLocation(cover?.type, attackData.location))
    ? cover?.armor ?? 0
    : 0;
  let choice = { ammoSpend: defaultAmmoSpend, adjustment: 0, barriers: String(barrier || '') };
  if (game.user.isGM || ammoSuccesses > 0) {
    choice = await YZEGSDialog.chooseDamage({
      primary,
      calculatedDamage: preview.calculatedDamage,
      ammoSuccesses,
      defaultAmmoSpend,
      minimumAmmoSpend: primary ? 0 : 1,
      location: primary ? attackData.location : '',
      target: defender.name,
      barrier,
      isGM: game.user.isGM,
    });
    if (choice.cancelled) return;
  }

  const allocation = resolveDamageAllocation({
    baseDamage: attackData.damage,
    baseSuccesses: effectiveSuccesses,
    ammoSuccesses,
    primaryApplied: state.primaryApplied,
    ammoSpend: choice.ammoSpend,
    adjustment: game.user.isGM ? choice.adjustment : 0,
  });
  const hitData = foundry.utils.deepClone(attackData);
  if (!primary) delete hitData.location;
  hitData.coverType = cover?.type ?? null;
  hitData.coverBarriers = choice.barriers
    ? choice.barriers.split(',').map(value => value.trim()).filter(Boolean)
    : [];
  const vehicleCoverUuid = primary && coverProtectsLocation(cover?.type, attackData.location)
    ? cover?.vehicleUuid
    : '';
  const vehicleCover = vehicleCoverUuid ? await resolveUuid(vehicleCoverUuid) : null;
  const damageTarget = vehicleCover?.actor ?? vehicleCover ?? defender.actor;
  if (damageTarget !== defender.actor) {
    ui.notifications.info(game.i18n.format('YZEGS.Urban.VehicleCover.Redirected', {
      target: damageTarget.name,
    }));
    hitData.coverType = null;
    hitData.coverBarriers = [];
  }
  if (damageTarget !== defender.actor && damageTarget.type === 'vehicle') {
    await damageTarget.applyDamage(allocation.damage, hitData, allocation.damage !== 0);
  }
  else await damageTarget.applyDamage(allocation.damage, hitData, allocation.damage !== 0);

  roll.options.damageApplication = {
    primaryApplied: true,
    ammoSuccessesRemaining: allocation.remainingAmmoSuccesses,
    complete: allocation.complete,
  };
  const content = await roll.render();
  await message.update({ content, rolls: [JSON.stringify(roll)] });
}

/* ------------------------------------------- */
/*  Auto-closing Roll Tooltip                  */
/* ------------------------------------------- */

/**
 * Closes the Roll tooltip
 * @param {ChatMessage} message The message
 * @param {HTMLElement} html DOM
 * @param {number} delay How many time to wait before closing the tooltips
 */
export function closeRollTooltip(message, html, delay = 60000) {
  if (!message.isRoll) return;
  const divs = html.find('.dice-result');
  if (!divs?.length) return;

  const div = divs[0];
  if (!div) return;

  setTimeout(() => {
    // tooltip.style.display = 'none';
    div.click();
  }, delay);
}
