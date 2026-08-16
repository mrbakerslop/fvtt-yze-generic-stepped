import YZEGSDialog from '../components/dialog/dialog.js';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getSkillCombatType } from './combat-modifiers.js';
import { resolveCombatActionSpend } from './combat-actions.js';
import { isActorInActiveCombat } from './reloading.js';
import { isBlockableAction } from './defense.js';
import { getEffectiveAttackSuccesses } from './defense.js';
import { createCloseAttackDeclaration } from './defense-workflows.js';
import {
  actionNeedsItem,
  actionNeedsTarget,
  getTwilightAction,
  getTwilightActionGroups,
  itemMatchesAction,
  TWILIGHT_ACTIONS,
} from './twilight-actions.js';
import {
  CQ_ENGAGEMENT_FLAG,
  closeQuartersCombatEnabled,
  isAllowedWhileEngaged,
  urbanCombatEnabled,
  URBAN_SYSTEM_ID,
} from './urban-operations.js';
import {
  beginCloseQuartersEngagement,
  clearCloseQuartersEngagement,
} from './urban-workflows.js';
import {
  enterDeepWater,
  rescueDrowningActor,
  submergeActor,
  surfaceActor,
} from './water-environment.js';
import { runWatercraftSheetAction } from './watercraft-workflows.js';
import {
  applyRammingOutcome,
  completeWatercraftHullRepair,
} from './watercraft-workflows.js';
import { getEnclosingVehicle } from './suppression.js';
import { getActionSkillName, getActorActionSkill } from './action-skills.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

function localize(key) {
  return key ? game.i18n.localize(key) : '';
}

function hasStatus(actor, statusId) {
  if (!actor) return false;
  if (actor.statuses?.has?.(statusId)) return true;
  return actor.effects?.some(effect => (
    effect.statuses?.has?.(statusId)
    || effect.getFlag?.('core', 'statusId') === statusId
  )) ?? false;
}

async function setStatus(actor, statusId, active) {
  if (!actor || hasStatus(actor, statusId) === active) return false;
  await actor.toggleStatusEffect(statusId, { active });
  return true;
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

function actionDisplay(action) {
  const value = Number(action.modifier) || 0;
  let displayValue = '–';
  if (value) displayValue = value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  return {
    id: action.id,
    label: localize(action.label),
    speed: action.speed,
    speedLabel: localize(`YZEGS.ActionTypes.${action.speed}`),
    value,
    displayValue,
  };
}

function actionData(action, actor, target, item) {
  const outcomeWorkflows = new Set([
    'breakFree', 'disarm', 'diveFromGrenade', 'extinguishFire', 'firstAid', 'grapple', 'rally',
    'retrieveItem', 'retreat', 'shove', 'breakFreeDebris', 'climbAboard',
    'rescueDrowning', 'grappleAttack',
    'freeVessel', 'repairHull', 'bailWater', 'ramVessel',
  ]);
  const failureMessages = {
    searchBoobyTrap: localize('YZEGS.Urban.BoobyTrap.Triggered'),
    clearMines: localize('YZEGS.Minefield.Actions.ClearFailed'),
  };
  return {
    actionId: action.id,
    modifierTargets: action.modifierTargets,
    label: localize(action.label),
    workflow: action.workflow,
    actorUuid: actor.uuid,
    targetUuid: target?.uuid ?? '',
    targetName: target?.name ?? '',
    itemUuid: item?.uuid ?? '',
    itemName: item?.name ?? '',
    canApplyOutcome: outcomeWorkflows.has(action.workflow),
    failureMessage: failureMessages[action.id] ?? '',
    applied: false,
  };
}

function uniqueTargets(actor) {
  const targets = new Map();
  targets.set(actor.uuid, {
    uuid: actor.uuid,
    name: `${actor.name} (${localize('YZEGS.CombatActions.Self')})`,
    type: actor.type,
    self: true,
  });
  for (const token of game.user.targets ?? []) {
    const target = token.actor;
    if (!target?.uuid || targets.has(target.uuid)) continue;
    targets.set(target.uuid, { uuid: target.uuid, name: target.name, type: target.type, self: false });
  }
  return [...targets.values()];
}

/** Prepare all action, target, and inventory choices for the Actor-sheet launcher. */
export function prepareTwilightActionDialog(actor, actions = TWILIGHT_ACTIONS) {
  actions = actions.filter(action => (
    action.launcher
    && (!action.urbanOnly || urbanCombatEnabled())
    && (!action.closeQuartersOnly || closeQuartersCombatEnabled())
    && (!action.closeQuartersExcluded || !closeQuartersCombatEnabled())
  ));
  const inCombat = isActorInActiveCombat(actor, game.combat);
  const actionGroups = getTwilightActionGroups(actions).map(group => ({
    speed: group.speed,
    label: localize(`YZEGS.ActionTypes.${group.speed}`),
    actions: group.actions.map(action => {
      const spend = resolveCombatActionSpend({
        inCombat,
        speed: action.speed,
        fast: actor.system.actions?.fast?.value,
        slow: actor.system.actions?.slow?.value,
      });
      return {
        ...action,
        name: `${localize(`YZEGS.CombatActions.Categories.${action.category}`)} — ${localize(action.label)}`,
        hint: localize(action.hint),
        disabled: !spend.available || (inCombat && !action.combatAllowed),
        usesSlowForFast: action.speed === 'fast' && spend.spentFrom === 'slow',
      };
    }),
  }));
  const items = [...actor.items].map(item => ({
    id: item.id,
    name: item.name,
    actionIds: actions.filter(action => itemMatchesAction(item, action)).map(action => action.id).join(' '),
  })).filter(item => item.actionIds);
  const selectedAction = actionGroups.flatMap(group => group.actions).find(action => !action.disabled);
  return {
    summary: inCombat
      ? game.i18n.format('YZEGS.CombatActions.Remaining', {
        fast: actor.system.actions?.fast?.value ?? 0,
        slow: actor.system.actions?.slow?.value ?? 0,
      })
      : localize('YZEGS.CombatActions.OutOfCombat'),
    actionGroups,
    targets: uniqueTargets(actor),
    items,
    selectedActionId: selectedAction?.id ?? '',
    selectedActionName: selectedAction?.name ?? '',
    targetChoices: uniqueTargets(actor).map(target => ({
      value: target.uuid,
      label: target.name,
      type: target.type,
      self: target.self,
    })),
    itemChoices: items.map(item => ({
      value: item.id,
      label: item.name,
      actionIds: item.actionIds,
    })),
  };
}

/** Validate and prepare a registry action selected from an ordinary Skill roll dialog. */
export async function prepareTwilightRollAction(actor, selection = {}) {
  const action = getTwilightAction(selection.actionId);
  const documents = await getSelectedDocuments(actor, action, selection);
  const valid = await validateAction(
    actor,
    action,
    documents.target,
    documents.item,
    documents.missingTarget,
    documents.missingItem,
  );
  if (valid !== true) return null;
  const { target, item } = documents;
  await preparePersistentActionStates(actor, action, target, item);
  return {
    combatAction: actionDisplay(action),
    actionData: actionData(action, actor, target, item),
  };
}

/** Record one-character treatment attempts after a First Aid or Rally roll is made. */
export async function recordTwilightActionAttempt(data) {
  if (!['firstAid', 'rally'].includes(data?.workflow)) return false;
  const actor = await resolveUuid(data.actorUuid);
  const target = await resolveUuid(data.targetUuid);
  if (!actor || !target || (!game.user.isGM && !target.isOwner)) return false;
  const flagName = data.workflow === 'firstAid' ? 'actionFirstAidAttempts' : 'actionRallyAttempts';
  const attempts = target.getFlag(SYSTEM_ID, flagName) ?? [];
  if (attempts.includes(actor.uuid)) return false;
  await target.setFlag(SYSTEM_ID, flagName, [...attempts, actor.uuid]);
  return true;
}

async function notifyActionError(key, data = {}) {
  const message = Object.keys(data).length ? game.i18n.format(key, data) : localize(key);
  ui.notifications.warn(message);
  return null;
}

function getSelectedDocuments(actor, action, { targetUuid = '', itemId = '' } = {}) {
  const item = itemId ? actor.items.get(itemId) : null;
  return Promise.resolve(resolveUuid(targetUuid)).then(target => ({
    target: target?.actor ?? target,
    item,
    missingTarget: actionNeedsTarget(action) && action.target !== 'optional' && !target,
    missingItem: actionNeedsItem(action) && !item,
  }));
}

async function validateAction(actor, action, target, item, missingTarget, missingItem) {
  if (!action) return notifyActionError('YZEGS.CombatActions.Errors.Unknown');
  if (missingTarget) return notifyActionError('YZEGS.CombatActions.Errors.TargetRequired');
  if (missingItem) return notifyActionError('YZEGS.CombatActions.Errors.ItemRequired');
  const inCombat = isActorInActiveCombat(actor, game.combat);
  if (inCombat && !action.combatAllowed) {
    return notifyActionError('YZEGS.CombatActions.Errors.ExtendedDuringCombat');
  }
  if (action.urbanOnly && !urbanCombatEnabled()) {
    return notifyActionError('YZEGS.CombatActions.Errors.CloseQuartersSceneRequired');
  }
  if (action.closeQuartersOnly && !closeQuartersCombatEnabled()) {
    return notifyActionError('YZEGS.CombatActions.Errors.CloseQuartersSceneRequired');
  }
  if (actor.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG) && !isAllowedWhileEngaged(action)) {
    return notifyActionError('YZEGS.Urban.Engagement.RestrictedAction');
  }
  if (inCombat && !action.reactive) {
    const currentActor = game.combat?.combatant?.actor;
    if (currentActor && currentActor.uuid !== actor.uuid && currentActor.id !== actor.id) {
      return notifyActionError('YZEGS.CombatActions.Errors.NotYourTurn');
    }
  }
  if (item && !itemMatchesAction(item, action)) return notifyActionError('YZEGS.CombatActions.Errors.InvalidItem');
  if (action.target === 'vehicle' && target?.type !== 'vehicle') {
    return notifyActionError('YZEGS.CombatActions.Errors.VehicleRequired');
  }
  const personTargetActions = new Set([
    'persuade', 'grapple', 'firstAid', 'rally', 'shove', 'disarm', 'grappleAttack', 'helpFast', 'helpSlow',
    'rescueDrowning',
  ]);
  if (target && personTargetActions.has(action.id) && !['character', 'npc'].includes(target.type)) {
    return notifyActionError('YZEGS.CombatActions.Errors.PersonRequired');
  }
  if (action.target === 'other' && target?.uuid === actor.uuid) {
    return notifyActionError('YZEGS.CombatActions.Errors.OtherTargetRequired');
  }
  const grappledBy = actor.getFlag(SYSTEM_ID, 'actionGrappledBy');
  const grappling = actor.getFlag(SYSTEM_ID, 'actionGrappling');
  if (grappledBy && action.id !== 'breakFree') {
    return notifyActionError('YZEGS.CombatActions.Errors.MustBreakFree');
  }
  if (grappling && action.id !== 'grappleAttack') {
    return notifyActionError('YZEGS.CombatActions.Errors.MustGrappleAttack');
  }
  if (action.id === 'grappleAttack' && target?.uuid !== grappling) {
    return notifyActionError('YZEGS.CombatActions.Errors.WrongGrappleTarget');
  }
  if (action.id === 'getUp' && !hasStatus(actor, 'prone')) {
    return notifyActionError('YZEGS.CombatActions.Errors.NotProne');
  }
  if (action.id === 'crawl' && !hasStatus(actor, 'prone')) {
    return notifyActionError('YZEGS.CombatActions.Errors.MustBeProne');
  }
  if (action.id === 'run' && hasStatus(actor, 'prone')) {
    return notifyActionError('YZEGS.CombatActions.Errors.MustStand');
  }
  if (action.id === 'fullToPartialCover' && !hasStatus(actor, 'fullCover')) {
    return notifyActionError('YZEGS.CombatActions.Errors.NotFullCover');
  }
  if (action.id === 'partialToFullCover' && !hasStatus(actor, 'partialCover')) {
    return notifyActionError('YZEGS.CombatActions.Errors.NotPartialCover');
  }
  if (action.id === 'breakFree' && !actor.getFlag(SYSTEM_ID, 'actionGrappledBy')) {
    return notifyActionError('YZEGS.CombatActions.Errors.NotGrappled');
  }
  if (action.id === 'breakFreeDebris' && !hasStatus(actor, 'pinnedByDebris')) {
    return notifyActionError('YZEGS.CombatActions.Errors.NotPinnedByDebris');
  }
  if (action.id === 'firstAid' && Number(target?.system.health?.value) > 0) {
    return notifyActionError('YZEGS.CombatActions.Errors.TargetNotIncapacitatedDamage');
  }
  if (action.id === 'firstAid') {
    const attempts = target.getFlag(SYSTEM_ID, 'actionFirstAidAttempts') ?? [];
    if (attempts.includes(actor.uuid) && !item) {
      return notifyActionError('YZEGS.CombatActions.Errors.AlreadyTriedFirstAid');
    }
  }
  if (action.id === 'rally' && Number(target?.system.sanity?.value) > 0) {
    return notifyActionError('YZEGS.CombatActions.Errors.TargetNotIncapacitatedStress');
  }
  if (action.id === 'rally') {
    const attempts = target.getFlag(SYSTEM_ID, 'actionRallyAttempts') ?? [];
    if (attempts.includes(actor.uuid)) return notifyActionError('YZEGS.CombatActions.Errors.AlreadyTriedRally');
  }
  if (action.id === 'extinguishFire' && !hasStatus(target ?? actor, 'fire')) {
    return notifyActionError('YZEGS.CombatActions.Errors.TargetNotOnFire');
  }
  const inWater = hasStatus(actor, 'swimming') || hasStatus(actor, 'submerged');
  if (inWater && ['shove', 'diveFromGrenade', 'dropProne', 'getUp', 'crawl'].includes(action.id)) {
    return notifyActionError('YZEGS.Water.Errors.ActionUnavailable');
  }
  if (['swim', 'stayAfloat', 'submerge', 'surface', 'climbAboard'].includes(action.id) && !inWater) {
    return notifyActionError('YZEGS.Water.Errors.MustBeInWater');
  }
  if (action.id === 'rescueDrowning' && !hasStatus(target, 'drowning')) {
    return notifyActionError('YZEGS.Water.Errors.TargetNotDrowning');
  }
  if (['turnLargeVessel', 'freeVessel', 'repairHull', 'bailWater', 'ramVessel'].includes(action.id)
    && !['watercraft', 'amphibious'].includes(target?.system?.domain)) {
    return notifyActionError('YZEGS.Water.Errors.WatercraftRequired');
  }
  return true;
}

async function spendImmediateAction(actor, action) {
  const spend = resolveCombatActionSpend({
    inCombat: isActorInActiveCombat(actor, game.combat),
    speed: action.speed,
    fast: actor.system.actions?.fast?.value,
    slow: actor.system.actions?.slow?.value,
  });
  if (!spend.available) {
    const key = action.speed === 'slow' ? 'YZEGS.CombatActions.NoSlowAction' : 'YZEGS.CombatActions.NoFastAction';
    return notifyActionError(key);
  }
  if (spend.tracked) {
    await actor.update({ [`system.actions.${spend.spentFrom}.value`]: spend.remaining[spend.spentFrom] });
  }
  return spend;
}

async function applyImmediateWorkflow(action, actor, target, item, workflowOptions = {}) {
  switch (action.workflow) {
    case 'prone': await setStatus(actor, 'prone', true); break;
    case 'stand': await setStatus(actor, 'prone', false); break;
    case 'partialCover':
      await setStatus(actor, 'fullCover', false);
      await setStatus(actor, 'partialCover', true);
      await actor.setFlag(SYSTEM_ID, 'actionCover', {
        ...(actor.getFlag(SYSTEM_ID, 'actionCover') ?? {}),
        ...(workflowOptions.cover ?? {}),
        type: 'partialCover',
      });
      break;
    case 'fullCover':
      await setStatus(actor, 'partialCover', false);
      await setStatus(actor, 'fullCover', true);
      await actor.setFlag(SYSTEM_ID, 'actionCover', {
        ...(actor.getFlag(SYSTEM_ID, 'actionCover') ?? {}),
        ...(workflowOptions.cover ?? {}),
        type: 'fullCover',
      });
      break;
    case 'drawItem': await item.update({ 'system.equipped': true, 'system.backpack': false }); break;
    case 'dropItem': await item.update({ 'system.equipped': false }); break;
    case 'dropBackpack': await actor.setFlag(SYSTEM_ID, 'actionBackpackDropped', true); break;
    case 'aim':
      await setStatus(actor, 'aiming', true);
      await actor.setFlag(SYSTEM_ID, 'actionAim', {
        mode: action.id,
        targetUuid: target?.uuid ?? '*',
        weaponUuid: item?.uuid ?? '',
      });
      break;
    case 'prepareBow': await item.setFlag(SYSTEM_ID, 'prepared', true); break;
    case 'prepareGrenade': await item.setFlag(SYSTEM_ID, 'prepared', true); break;
    case 'overwatch': {
      await setStatus(actor, 'overwatch', true);
      let overwatchMode = 'general';
      if (action.id === 'overwatchAperture') overwatchMode = 'aperture';
      else if (target) overwatchMode = 'character';
      await actor.setFlag(SYSTEM_ID, 'actionOverwatch', {
        targetUuid: target?.uuid ?? '',
        weaponUuid: item?.uuid ?? '',
        mode: overwatchMode,
      });
      break;
    }
    case 'vehicleCover':
      await setStatus(actor, 'fullCover', false);
      await setStatus(actor, 'partialCover', true);
      await actor.setFlag(SYSTEM_ID, 'actionCover', {
        type: 'partialCover',
        armor: 1,
        againstUuid: '*',
        vehicleUuid: target?.uuid ?? '',
        vehicleName: target?.name ?? '',
      });
      break;
    case 'hugWall':
      await setStatus(actor, 'huggingWall', true);
      await actor.setFlag(SYSTEM_ID, 'urbanHuggingWall', { round: game.combat?.round ?? 0 });
      break;
    case 'submerge': await submergeActor(actor); break;
    case 'surface': await surfaceActor(actor); break;
    case 'turnLargeVessel': await runWatercraftSheetAction(target, 'turn'); break;
    case 'ramVessel': await runWatercraftSheetAction(target, 'ram'); break;
    case 'bailOut':
      if (['watercraft', 'amphibious'].includes(target?.system?.domain)) {
        await enterDeepWater(actor, { cold: false });
        await setStatus(actor, 'overboard', true);
      }
      break;
  }
}

async function preparePersistentActionStates(actor, action, target, item) {
  if (['run', 'crawl', 'retreat', 'crossLowBarrier', 'crossHighBarrier', 'moveThroughDoor'].includes(action.id)) {
    await setStatus(actor, 'partialCover', false);
    await setStatus(actor, 'fullCover', false);
    await actor.unsetFlag(SYSTEM_ID, 'actionCover');
  }
  if (hasStatus(actor, 'aiming') && action.workflow !== 'aim') {
    const aim = actor.getFlag(SYSTEM_ID, 'actionAim') ?? {};
    const maintainsAim = action.workflow === 'attack'
      && [target?.uuid, '*'].includes(aim.targetUuid)
      && aim.weaponUuid === item?.uuid;
    if (!maintainsAim) {
      await setStatus(actor, 'aiming', false);
      await actor.unsetFlag(SYSTEM_ID, 'actionAim');
    }
  }
  if (hasStatus(actor, 'overwatch') && action.workflow !== 'overwatch') {
    await setStatus(actor, 'overwatch', false);
    await actor.unsetFlag(SYSTEM_ID, 'actionOverwatch');
  }
  if (hasStatus(actor, 'huggingWall') && [
    'run', 'crawl', 'retreat', 'crossLowBarrier', 'crossHighBarrier', 'moveThroughDoor',
    'enterBuilding', 'moveSector', 'changeFloor', 'climbFloor',
    'moveIndoorHex',
  ].includes(action.id)) {
    await setStatus(actor, 'huggingWall', false);
    await actor.unsetFlag(SYSTEM_ID, 'urbanHuggingWall');
  }
  if (!['prepareBow', 'aim', 'shootBow'].includes(action.id)) {
    const preparedBows = [...actor.items].filter(ownedItem => (
      ownedItem.getFlag(SYSTEM_ID, 'prepared')
      && /bow/.test(String(ownedItem.system.itemType ?? '').toLocaleLowerCase())
      && !/crossbow/.test(String(ownedItem.system.itemType ?? '').toLocaleLowerCase())
    ));
    await Promise.all(preparedBows.map(bow => bow.unsetFlag(SYSTEM_ID, 'prepared')));
  }
}

async function postActionCard(actor, action, target, item, spend, resultText = '') {
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/chat/action-chat.hbs',
    {
      actor,
      action: { name: localize(action.label), speedName: localize(`YZEGS.ActionTypes.${action.speed}`) },
      targetName: target?.name ?? '',
      itemName: item?.name ?? '',
      spend: {
        ...spend,
        spentFromName: spend.spentFrom ? localize(`YZEGS.ActionTypes.${spend.spentFrom}`) : '',
      },
      resultText,
    },
  );
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/** Execute a selected action, delegating weapon, reload, and roll workflows as appropriate. */
export async function executeTwilightAction(actor, selection = {}) {
  const action = getTwilightAction(selection.actionId);
  const documents = await getSelectedDocuments(actor, action, selection);
  const valid = await validateAction(
    actor,
    action,
    documents.target,
    documents.item,
    documents.missingTarget,
    documents.missingItem,
  );
  if (valid !== true) return null;
  const { target, item } = documents;
  if (
    isBlockableAction(action.id)
    && !selection.skipDefenseDeclaration
  ) {
    return createCloseAttackDeclaration({
      attacker: actor,
      defender: target,
      item,
      actionId: action.id,
      selection,
    });
  }
  await preparePersistentActionStates(actor, action, target, item);

  if (action.workflow === 'reload') return item.reload();
  if (action.workflow === 'clearJam') return item.clearJam();

  const display = actionDisplay(action);
  const workflowData = actionData(action, actor, target, item);
  if (action.workflow === 'attack') {
    const result = await item.rollAttack({
      combatAction: display,
      actionData: workflowData,
      defense: selection.defense ?? null,
      messageMode: selection.messageMode ?? null,
      skipDefenseDeclaration: true,
      hideCombatActions: true,
    });
    if (result && action.id === 'shootBow') await item.unsetFlag(SYSTEM_ID, 'prepared');
    return result;
  }

  if (action.skill) {
    const skill = getActorActionSkill(actor, action.id, action.skill);
    if (!skill) {
      return notifyActionError('YZEGS.CombatActions.Errors.SkillMissing', {
        skill: getActionSkillName(action.id, action.skill),
      });
    }
    const stats = getAttributeAndSkill(skill, actor);
    const result = await YZEGSRoller.taskCheck({
      ...stats,
      title: `${localize(action.label)}: ${actor.name}`,
      actor,
      combatType: getSkillCombatType(skill),
      combatAction: display,
      actionData: workflowData,
      defense: selection.defense ?? null,
      messageMode: selection.messageMode ?? null,
      attackData: action.id === 'unarmedAttack' ? {
        damage: 1,
        crit: 4,
        armorModifier: 3,
        blast: 0,
        range: 0,
      } : null,
      locate: action.id === 'unarmedAttack',
      modifier: action.modifier + (
        ['swim', 'stayAfloat'].includes(action.id)
        && Number(actor.system.encumbrance?.backpack?.value) > 0
        && !actor.getFlag(SYSTEM_ID, 'actionBackpackDropped') ? -2 : 0
      ),
      hideCombatActions: true,
    });
    if (result && action.id === 'unarmedAttack') await beginCloseQuartersEngagement(actor, target);
    return result;
  }

  let workflowOptions = {};
  if (['seekPartialCover', 'seekFullCover'].includes(action.id)) {
    const cover = await YZEGSDialog.chooseCover({
      armor: actor.coverDetails?.armor ?? 1,
      againstName: target?.name ?? '',
    });
    if (cover.cancelled) return null;
    workflowOptions = {
      cover: {
        armor: cover.armor,
        againstUuid: target?.uuid ?? '*',
        againstName: target?.name ?? '',
      },
    };
  }
  const spend = await spendImmediateAction(actor, action);
  if (!spend) return null;
  await applyImmediateWorkflow(action, actor, target, item, workflowOptions);
  return postActionCard(actor, action, target, item, spend);
}

async function chooseDisarmedItem(target) {
  const items = [...target.items].filter(item => (
    item.system.equipped && ['weapon', 'gear', 'grenade'].includes(item.type)
  ));
  if (items.length <= 1) return items[0] ?? null;
  const options = items.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
  const content = '<div class="form-group">'
    + `<label>${localize('YZEGS.CombatActions.Item')}</label>`
    + `<select name="itemId">${options}</select></div>`;
  const result = await YZEGSDialog._wait({
    title: localize('YZEGS.ActionNames.disarm'),
    content,
    actionLabel: localize('YZEGS.CombatActions.ApplyOutcome'),
    processForm: form => ({ itemId: form.elements.namedItem('itemId')?.value ?? '' }),
  });
  return result.cancelled ? null : target.items.get(result.itemId);
}

async function clearGrapple(actor) {
  const grapplerUuid = actor.getFlag(SYSTEM_ID, 'actionGrappledBy');
  const grappledUuid = actor.getFlag(SYSTEM_ID, 'actionGrappling');
  const counterpart = await resolveUuid(grapplerUuid || grappledUuid);
  await setStatus(actor, 'restrain', false);
  await actor.unsetFlag(SYSTEM_ID, 'actionGrappledBy');
  await actor.unsetFlag(SYSTEM_ID, 'actionGrappling');
  if (counterpart && (game.user.isGM || counterpart.isOwner)) {
    await setStatus(counterpart, 'restrain', false);
    await counterpart.unsetFlag(SYSTEM_ID, 'actionGrappledBy');
    await counterpart.unsetFlag(SYSTEM_ID, 'actionGrappling');
  }
}

/** Apply the final, accepted result of an action roll. */
export async function applyTwilightActionOutcome(roll) {
  const data = roll?.options?.actionData;
  if (!data?.canApplyOutcome || data.applied) return false;
  const successes = getEffectiveAttackSuccesses(roll);
  if (!successes) return notifyActionError('YZEGS.CombatActions.Errors.NoSuccess');
  const actor = await resolveUuid(data.actorUuid);
  const target = (await resolveUuid(data.targetUuid)) ?? actor;
  const item = await resolveUuid(data.itemUuid);
  if (!actor || !target) return notifyActionError('YZEGS.CombatActions.Errors.StaleTarget');
  if (!game.user.isGM && !target.isOwner) {
    return notifyActionError('YZEGS.CombatActions.Errors.TargetPermission');
  }

  switch (data.workflow) {
    case 'firstAid': {
      const maximum = Number(target.system.health?.max) || 0;
      const current = Number(target.system.health?.value) || 0;
      await target.update({ 'system.health.value': Math.min(maximum, current + successes) });
      await target.unsetFlag(SYSTEM_ID, 'actionFirstAidAttempts');
      break;
    }
    case 'rally': {
      const maximum = Number(target.system.sanity?.max) || 0;
      const current = Number(target.system.sanity?.value) || 0;
      await target.update({ 'system.sanity.value': Math.min(maximum, current + successes) });
      await target.unsetFlag(SYSTEM_ID, 'actionRallyAttempts');
      break;
    }
    case 'shove': {
      const required = Number(target.system.attributes?.str?.value) > Number(actor.system.attributes?.str?.value)
        ? 2
        : 1;
      if (successes < required) {
        return notifyActionError('YZEGS.CombatActions.Errors.MoreSuccessesRequired', { required });
      }
      await setStatus(target, 'prone', true);
      await clearCloseQuartersEngagement(target);
      break;
    }
    case 'disarm': {
      const disarmed = await chooseDisarmedItem(target);
      if (!disarmed) return false;
      const required = disarmed.system.props?.twoHanded ? 2 : 1;
      if (successes < required) {
        return notifyActionError('YZEGS.CombatActions.Errors.MoreSuccessesRequired', { required });
      }
      await disarmed.update({ 'system.equipped': false });
      break;
    }
    case 'grapple':
      await setStatus(actor, 'prone', true);
      await setStatus(target, 'prone', true);
      await setStatus(target, 'restrain', true);
      await actor.setFlag(SYSTEM_ID, 'actionGrappling', target.uuid);
      await target.setFlag(SYSTEM_ID, 'actionGrappledBy', actor.uuid);
      break;
    case 'breakFree': await clearGrapple(actor); break;
    case 'breakFreeDebris': await setStatus(actor, 'pinnedByDebris', false); break;
    case 'retreat': await clearCloseQuartersEngagement(actor); break;
    case 'retrieveItem': await item?.update({ 'system.backpack': false, 'system.equipped': false }); break;
    case 'extinguishFire': await setStatus(target, 'fire', false); break;
    case 'diveFromGrenade': await setStatus(actor, 'prone', true); break;
    case 'climbAboard': await surfaceActor(actor); break;
    case 'rescueDrowning': await rescueDrowningActor(target); break;
    case 'grappleAttack': {
      if (!hasStatus(actor, 'swimming') && !hasStatus(actor, 'submerged')) break;
      await submergeActor(target);
      const stamina = getActorActionSkill(target, 'stayAfloat', 'stamina');
      if (!stamina) break;
      const result = await YZEGSRoller.taskCheck({
        ...getAttributeAndSkill(stamina, target),
        title: game.i18n.format('YZEGS.Water.Drowning.HoldBreath', { actor: target.name }),
        actor: target,
        maxPush: 0,
        skipDialog: true,
        hideCombatActions: true,
      });
      const drowningRoll = result?.rolls?.[0] ?? result;
      if ((Number(drowningRoll?.baseSuccessQty) || 0) < 1) await setStatus(target, 'drowning', true);
      break;
    }
    case 'freeVessel':
      await target.update({
        'system.watercraft.grounded': false,
        'system.watercraft.stuck': false,
        ...(Number(target.system.watercraft.hullBreaches) > 0 ? {
          'system.watercraft.sinking': true,
          'system.watercraft.sinkingDeadline': (Number(game.time?.worldTime) || 0) + 900,
        } : {}),
      });
      break;
    case 'repairHull':
      if (!await completeWatercraftHullRepair(target)) return false;
      break;
    case 'bailWater':
      await target.update({
        'system.watercraft.sinkingProgress': Math.max(
          0,
          Number(target.system.watercraft.sinkingProgress) - successes,
        ),
        'system.watercraft.sinkingDeadline': (Number(game.time?.worldTime) || 0) + 900,
      });
      break;
    case 'ramVessel': {
      const enclosing = getEnclosingVehicle(actor, game.actors);
      if (!enclosing?.vehicle) return notifyActionError('YZEGS.Water.Errors.MustBeAboardWatercraft');
      await applyRammingOutcome(enclosing.vehicle, target, successes);
      break;
    }
    default: return false;
  }
  data.applied = true;
  return true;
}
