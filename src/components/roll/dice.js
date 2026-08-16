import YZEGSDialog from '../dialog/dialog.js';
import { YearZeroRoll } from '../../lib/yzur.js';
import { YZEGS } from '../../system/config.js';
import { range } from '@utils/utils.js';
import {
  getCombatActionGroups,
  getCombatModifierGroups,
  getSkillCombatType,
} from '../../system/combat-modifiers.js';
import {
  applyRollPushCosts,
  applyWeaponJam,
  getPushCostMode,
  prepareRollPushCosts,
  PUSH_COST_MODES,
  resolvePushCostDocuments,
} from '../../system/push-costs.js';
import { isUnitMoraleEnabled } from '../../system/settings.js';
import { isActorInActiveCombat } from '../../system/reloading.js';
import { resolveCombatActionSpend } from '../../system/combat-actions.js';
import { getTwilightAction } from '../../system/twilight-actions.js';
import { getConfiguredSkillRollActions } from '../../system/action-skills.js';
import { getBlindFireRoll } from '../../system/urban-operations.js';

function displayActionModifier(value) {
  value = Number(value) || 0;
  if (!value) return '–';
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/* -------------------------------------------- */
/*  Custom Dice Roller Interface                */
/* -------------------------------------------- */

/**
 * Interface for performing tasks and rolling dice.
 * @abstract
 * @interface
 */
export class YZEGSRoller {
  constructor() {
    throw new SyntaxError(`${this.constructor.name} cannot be instanciated. Use static methods instead.`);
  }

  /* -------------------------------------------- */

  /**
   * Rolls dice for YZEGS.
   * @param {string?}  title                The title of the roll
   * @param {Actor?}   actor                The actor who rolled the dice, if any
   * @param {Item?}    item                 The item used to roll the dice, if any
   * @param {string?}  attributeName        The name of the attribute used (important for modifiers)
   * @param {string?}  skillName            The Skill Item ID used (important for modifiers)
   * @param {string?}  combatType           Whether this is a Close or Ranged Combat roll
   * @param {string?}  checkType            A special roll type used to render check-specific results
   * @param {number}  [attribute=0]         The attribute's size
   * @param {number}  [skill=0]             The skill's size
   * @param {number}  [rof=0]               The RoF's value
   * @param {number}  [modifier=0]          The task modifier
   * @param {boolean} [locate=false]        Whether to roll a Location die
   * @param {object?} [attackData=null]     Effective attack profile to preserve on the roll
   * @param {object?} [actionData=null]     Action workflow data to preserve on the roll
   * @param {object?} [defense=null]        Linked close-combat defense declaration
   * @param {object?} [defenseFor=null]     Attack message linked to a Block roll
   * @param {object?} [suppression=null]    Suppression targets or originating attack context
   * @param {object?} [combatAction=null]   Preselected action to spend and display
   * @param {object[]?} [combatActionChoices=null] Constrained action choices for an Item attack
   * @param {boolean} [hideCombatActions=false] Hide action choices while retaining modifiers
   * @param {number}  [maxPush=1]           The maximum number of pushes (default is 1)
   * @param {string?}  messageMode          Chat message visibility mode
   * @param {boolean} [askForOptions=false] Whether to show a Dialog for roll options
   * @param {boolean} [skipDialog=false]    Whether to force skip the Dialog for roll options
   * @param {boolean} [sendMessage=true]    Whether the message should be sent
   * @returns {Promise<YearZeroRoll|ChatMessage>} If sendMessage=true, returns the ChatMessage,
   *      otherwise returns the YearZeroRoll.
   * @static
   * @async
   */
  static async taskCheck({
    title = 'Year Zero Engine - Generic Stepped Dice – Task Check',
    actor = null,
    item = null,
    attributeName = null,
    skillName = null,
    combatType = null,
    checkType = null,
    attribute = 0,
    skill = 0,
    rof = 0,
    modifier = 0,
    locate = false,
    attackData = null,
    actionData = null,
    defense = null,
    defenseFor = null,
    suppression = null,
    combatAction = null,
    combatActionChoices = null,
    hideCombatActions = false,
    maxPush = 1,
    messageMode = null,
    askForOptions = false,
    skipDialog = false,
    sendMessage = true,
  } = {}) {
    // 1 — Prepares data.
    messageMode = messageMode ?? game.settings.get('core', 'messageMode');

    // 2 — Checks if we ask for options (roll dialog).
    const showTaskCheckOptions = game.settings.get('fvtt-yze-generic-stepped', 'showTaskCheckOptions');
    let situationalModifiers = [];
    if (!skipDialog && askForOptions !== showTaskCheckOptions) {
      // 2.1 — Prepares a formula.
      const formula = YearZeroRoll.forge(
        getDiceQuantities(attribute, skill),
      ).formula;

      // Resolve contextual actions before the dialog so an ordinary Skill test
      // offers only the actions which actually use that Skill.
      const skillItem = actor?.getSkill?.(skillName);
      const skillActions = hideCombatActions || combatActionChoices?.length
        ? []
        : getConfiguredSkillRollActions(skillItem);
      let skillActionDialog = null;
      if (skillActions.length) {
        const { prepareTwilightActionDialog } = await import('../../system/twilight-action-workflows.js');
        skillActionDialog = prepareTwilightActionDialog(actor, skillActions);
      }

      // 2.2 — Handles roll modifiers.
      let modifiers;
      if (actor) {
        modifiers = actor.getRollModifiers();
        const contextualActions = skillActions.length
          ? skillActions
          : (combatActionChoices ?? []).map(choice => getTwilightAction(choice.id) ?? {
            id: choice.id,
            modifierTargets: [choice.id],
          });
        const skillActionModifierTargets = contextualActions.flatMap(action => action.modifierTargets);
        const actionModifierTargets = actionData?.modifierTargets
          ?? [combatAction?.id, ...skillActionModifierTargets].filter(Boolean);
        if (skillName || attributeName || actionModifierTargets.length) {
          modifiers = modifiers.filter(entry => (
            entry.target === skillName
            || entry.target === attributeName
            || (entry.category === 'action' && actionModifierTargets.includes(entry.target))
          ));
        }
        if (contextualActions.length > 1 || skillActions.length) {
          for (const entry of modifiers.filter(modifierEntry => modifierEntry.category === 'action')) {
            entry.contextualActionIds = contextualActions.filter(action => (
              action.modifierTargets.includes(entry.target)
            )).map(action => action.id).join(' ');
            entry.contextualDefaultActive = entry.active;
            entry.contextualActionModifier = true;
            entry.active = false;
          }
        }
        if (modifiers.length) {
          modifier += modifiers.reduce((sum, m) => sum + (m.active ? m.value : 0), 0);
        }
      }

      // 2.3 — Renders the dialog.
      const tracksCombatActions = ['character', 'npc'].includes(actor?.type)
        && isActorInActiveCombat(actor, game.combat);
      const trackedActions = {
        fast: actor?.system.actions?.fast?.value ?? 0,
        slow: actor?.system.actions?.slow?.value ?? 0,
      };
      let baseActionGroups = [];
      if (!hideCombatActions && combatActionChoices?.length) {
        baseActionGroups = ['slow', 'fast', 'free'].map(speed => ({
          id: speed,
          name: game.i18n.localize(`YZEGS.ActionTypes.${speed}`),
          actions: combatActionChoices.filter(action => action.speed === speed).map(action => ({
            ...action,
            name: action.label,
            group: action.speed,
            speedName: action.speedLabel,
            value: Number(action.value) || 0,
            displayValue: action.displayValue ?? '–',
            registry: false,
          })),
        })).filter(group => group.actions.length);
      }
      else if (skillActionDialog) {
        baseActionGroups = skillActionDialog.actionGroups.map(group => ({
          ...group,
          name: group.label,
          actions: group.actions.map(action => ({
            ...action,
            name: game.i18n.localize(action.label),
            group: action.speed,
            speedName: group.label,
            value: Number(action.modifier) || 0,
            displayValue: displayActionModifier(action.modifier),
            registry: true,
          })),
        })).filter(group => group.actions.length);
      }
      else if (!hideCombatActions) baseActionGroups = getCombatActionGroups(combatType);
      const combatActionGroups = baseActionGroups.map(group => ({
        ...group,
        actions: group.actions.map(action => {
          if (!tracksCombatActions) return action;
          const actionSpend = resolveCombatActionSpend({
            inCombat: true,
            speed: action.group,
            ...trackedActions,
          });
          return {
            ...action,
            disabled: Boolean(action.disabled) || !actionSpend.available,
            usesSlowForFast: action.group === 'fast' && actionSpend.spentFrom === 'slow',
          };
        }),
      }));
      const combatModifierGroups = getCombatModifierGroups(combatType);
      const opts = await YZEGSDialog.askRollOptions({
        title, attribute, skill, rof, modifier, modifiers, locate,
        maxPush, messageMode, formula, combatType, combatActionGroups, combatModifierGroups,
        tracksCombatActions, trackedActions,
        actionHeading: skillActionDialog
          ? game.i18n.localize('YZEGS.CombatActions.DialogTitle')
          : game.i18n.localize(`YZEGS.CombatModifiers.CombatTypes.${combatType}`),
        actionTargets: skillActionDialog?.targetChoices ?? [],
        actionItems: skillActionDialog?.itemChoices ?? [],
        selectedCombatActionId: combatActionChoices?.some(action => action.id === combatAction?.id)
          ? combatAction.id
          : '',
        selectedCombatActionLabel: combatActionChoices?.find(action => action.id === combatAction?.id)?.label ?? '',
      });

      // 2.3.5 — Exits early if the dialog was cancelled.
      if (opts.cancelled) return null;

      // 2.4 — Uses options from the roll dialog.
      if (!attribute && !skill) {
        attribute = opts.attribute;
        skill = opts.skill;
      }
      rof = opts.rof;
      modifier = opts.modifier;
      if (opts.combatAction?.registry) {
        const { prepareTwilightRollAction } = await import('../../system/twilight-action-workflows.js');
        const preparedAction = await prepareTwilightRollAction(actor, {
          actionId: opts.combatAction.id,
          targetUuid: opts.targetUuid,
          itemId: opts.itemId,
        });
        if (!preparedAction) return null;
        combatAction = preparedAction.combatAction;
        actionData = preparedAction.actionData;
        title = `${combatAction.label}: ${actor.name}`;
      }
      else if (opts.combatAction) combatAction = opts.combatAction;
      if (combatAction?.rollMode === 'blindFire') {
        const blindFire = getBlindFireRoll({
          rof: opts.rof,
          explosive: attackData?.blast && attackData.blast !== '–',
        });
        attribute = blindFire.attribute;
        skill = blindFire.skill;
        rof = blindFire.rof;
        locate = blindFire.locate;
        attackData = {
          ...(attackData ?? {}),
          blindFire: true,
          canDirectHit: blindFire.canDirectHit,
          automaticHexHit: blindFire.automaticHexHit,
        };
      }
      if (tracksCombatActions && combatActionGroups.length && !combatAction) {
        ui.notifications.warn(game.i18n.localize('YZEGS.CombatActions.Errors.ActionRequired'));
        return null;
      }
      situationalModifiers = opts.situationalModifiers;
      locate = opts.locate;
      maxPush = opts.maxPush;
      messageMode = opts.messageMode;
    }

    // Spend the selected action only after the dialog is confirmed. Re-read the
    // Actor here in case another roll or sheet update changed the pools while it was open.
    if (combatAction && ['character', 'npc'].includes(actor?.type)) {
      const inActiveCombat = isActorInActiveCombat(actor, game.combat);
      const actionSpend = resolveCombatActionSpend({
        inCombat: inActiveCombat,
        speed: combatAction.speed,
        fast: actor.system.actions?.fast?.value,
        slow: actor.system.actions?.slow?.value,
      });
      if (!actionSpend.available) {
        const key = combatAction.speed === 'slow'
          ? 'YZEGS.CombatActions.NoSlowAction'
          : 'YZEGS.CombatActions.NoFastAction';
        ui.notifications.warn(game.i18n.localize(key));
        return null;
      }
      if (actionSpend.tracked) {
        await actor.update({
          [`system.actions.${actionSpend.spentFrom}.value`]: actionSpend.remaining[actionSpend.spentFrom],
        });
        combatAction = {
          ...combatAction,
          tracked: true,
          spentFrom: actionSpend.spentFrom,
          spentFromLabel: game.i18n.localize(`YZEGS.ActionTypes.${actionSpend.spentFrom}`),
          remaining: actionSpend.remaining,
        };
      }
    }
    // 3 — Clamps values.
    attribute = Math.clamp(attribute, 0, 12);
    skill = Math.clamp(skill, 0, 12);
    modifier = Math.clamp(modifier, -100, 100);
    maxPush = Math.clamp(maxPush, 0, 100);

    // 4 — Creates the roll.
    const dice = getDiceQuantities(attribute, skill, rof, locate);
    let roll = YearZeroRoll.forge(dice, { maxPush });
    roll.name = title;
    roll.options.combatType = combatType;
    roll.options.checkType = checkType;
    roll.options.combatAction = combatAction;
    if (actionData) roll.options.actionData = foundry.utils.deepClone(actionData);
    if (defense) roll.options.defense = foundry.utils.deepClone(defense);
    if (defenseFor) roll.options.defenseFor = foundry.utils.deepClone(defenseFor);
    if (suppression) roll.options.suppression = foundry.utils.deepClone(suppression);
    roll.options.situationalModifiers = situationalModifiers;
    roll.options.modifier = modifier;
    roll.options.signedModifier = modifier >= 0 ? `+${modifier}` : `−${Math.abs(modifier)}`;
    roll.options.attributeName = attributeName;
    if (attackData) roll.options.attackData = foundry.utils.deepClone(attackData);

    // 5 — Modifies the roll.
    if (modifier) {
      roll = await roll.modify(modifier);
    }

    // 6 — Adds actor/token/item IDs.
    // These are added to `roll.options` which is conserved.
    if (actor) {
      roll.options.actorId = actor.id;
      roll.options.actorUuid = actor.uuid;
      const token = actor.token;
      if (token) {
        roll.options.sceneId = token.parent.id;
        roll.options.tokenId = token.id;
        roll.options.tokenKey = `${token.parent.id}.${token.id}`;
      }
    }
    if (item) {
      roll.options.itemId = item.id;
      roll.options.itemUuid = item.uuid;
    }

    // 7 — Evaluates the roll.
    await roll.roll();
    console.log('yzegs | ROLL', roll.name, roll);

    // 8 — Sends the message and returns.
    const result = sendMessage ? await roll.toMessage({}, { messageMode }) : roll;
    if (actionData) {
      const { recordTwilightActionAttempt } = await import('../../system/twilight-action-workflows.js');
      await recordTwilightActionAttempt(actionData);
    }
    return result;
  }

  /* -------------------------------------------- */

  /**
   * Rolls dice for a Coolness Under Fire test.
   * @returns {Promise<YearZeroRoll|ChatMessage>}
   */
  static async cufCheck({
    title = game.i18n.localize('YZEGS.Dialog.CuF.CoolnessUnderFire'),
    actor = null,
    unitMorale = false,
    modifier = 0,
    messageMode = null,
    sendMessage = true,
    suppression = null,
  } = {}) {
    if (!actor) return;
    messageMode = messageMode ?? game.settings.get('core', 'messageMode');
    const unitMoraleEnabled = isUnitMoraleEnabled();
    if (!unitMoraleEnabled) unitMorale = false;
    const modifiers = actor.getRollModifiers().filter(m => m.target === 'cuf');
    const opts = await YZEGSDialog.askCuFOptions({
      title, unitMorale, unitMoraleEnabled, modifier, modifiers, messageMode,
    });

    // Exits early if the dialog was cancelled.
    if (opts.cancelled) return null;

    // Uses options from the CuF dialog.
    unitMorale = unitMoraleEnabled && opts.unitMorale;
    messageMode = opts.messageMode;
    modifier = opts.modifier;

    // Gets attributes' values.
    const cuf = actor.system.cuf.value;
    const um = actor.system.unitMorale.value;

    return this.taskCheck({
      title,
      checkType: 'cuf',
      actor,
      attributeName: 'cuf',
      attribute: cuf,
      skill: unitMorale ? um : 0,
      modifier, maxPush: 0, messageMode,
      skipDialog: true,
      sendMessage,
      suppression,
    });
  }
}

/* -------------------------------------------- */
/*  Roll Push                                   */
/* -------------------------------------------- */

/**
 * Pushes a roll.
 * @param {YearZeroRoll} roll     The roll to push
 * @param {ChatMessage} [message] The message holding the roll that will be deleted
 * @returns {Promise<YearZeroRoll|ChatMessage>}
 * @async
 */
export async function rollPush(roll, { message } = {}) {
  if (!roll.pushable) return roll;

  // Copies the roll.
  roll = roll.duplicate();

  // Pushes the roll.
  await roll.push({ async: true });

  // Creates a pushed message even when no prior chat message was supplied.
  if (!message) {
    const { actor: rollActor, item: rollItem } = resolvePushCostDocuments(roll);
    prepareRollPushCosts(roll, { actor: rollActor, item: rollItem });
    await applyWeaponJam(roll, rollItem);
    if (getPushCostMode() === PUSH_COST_MODES.AUTOMATIC) {
      await applyRollPushCosts(roll, { actor: rollActor, item: rollItem });
    }
    return roll.toMessage();
  }

  // Gets all the message's flags.
  const flags = message.getFlag('fvtt-yze-generic-stepped', 'data') ?? {};
  const oldAmmoSpent = flags.ammoSpent || 0;
  let newAmmoSpent = -Math.max(1, roll.ammoSpent); // why roll.ammoSpent + 1 here
  const { actor, item } = resolvePushCostDocuments(roll);
  const ammoId = flags.ammo ?? (item ? item.system.mag?.target : '');
  const ammoOwner = item?.actor ?? actor;
  const ammo = ammoOwner?.items.get(ammoId) ?? game.items.get(ammoId);
  let flagData = { ...flags };

  prepareRollPushCosts(roll, { flags, actor, item });
  await applyWeaponJam(roll, item);
  if (getPushCostMode() === PUSH_COST_MODES.AUTOMATIC) {
    const result = await applyRollPushCosts(roll, { flags, actor, item });
    flagData = result.flags;
  }

  // Updates the ammunition.
  if (ammo) {
    const track = (ammoOwner.type === 'character' && game.settings.get('fvtt-yze-generic-stepped', 'trackPcAmmo'))
      || (ammoOwner.type === 'npc' && game.settings.get('fvtt-yze-generic-stepped', 'trackNpcAmmo'))
      || (ammoOwner.type === 'vehicle' && game.settings.get('fvtt-yze-generic-stepped', 'trackVehicleAmmo'));

    if (track) {
      flagData.ammoSpent = oldAmmoSpent;

      if (oldAmmoSpent !== newAmmoSpent) {
        newAmmoSpent = await ammo.updateAmmo(newAmmoSpent - oldAmmoSpent);
        flagData.ammoSpent = oldAmmoSpent + newAmmoSpent;
      }
      flagData.ammo = ammo.id;
    }
  }

  // Replace the previous result only after all document updates have completed.
  await message.delete();
  const messageData = foundry.utils.isEmpty(flagData) ? {} : {
    flags: { 'fvtt-yze-generic-stepped': { data: flagData } },
  };
  const m = await roll.toMessage(messageData);

  return m;
}

/* -------------------------------------------- */
/*  Dice Utility Functions                      */
/* -------------------------------------------- */

/**
 * Gets the size of a die from its rating.
 * @param {string} score A, B, C, D or F
 */
export function getDieSize(score) {
  if (typeof score !== 'string') throw new TypeError(`Die Score Not a String: "${score}"`);
  if (score.length !== 1) throw new SyntaxError(`Die Score Incorrect: "${score}"`);
  const size = YZEGS.dieSizesMap.get(score);
  if (size == undefined) throw new RangeError(`Die Size Not Found! Score: "${score}"`);
  return size;
}

/* -------------------------------------------- */

/**
 * Gets the Attribute and Skill values (+ the skill's name).
 * @param {string|Item} skillReference The embedded Skill Item or its ID
 * @param {Actor} actor The Actor making the roll
 * @param {string} [attributeName] The code of the attribute if different from the linked skill
 * @returns {{ title: string, attribute: number, skill: number }}
 */
export function getAttributeAndSkill(skillReference, actor, attributeName = null) {
  const skillItem = actor.getSkill(skillReference);
  if (!skillItem) throw new Error(`Skill Item not found: ${skillReference}`);
  attributeName = attributeName ?? skillItem.system.attribute;
  const attribute = actor.system.attributes[attributeName]?.value ?? 0;
  return {
    title: skillItem.name,
    attribute,
    skill: skillItem.system.value,
    attributeName,
    skillName: skillItem.id,
    combatType: getSkillCombatType(skillItem),
  };
}

/* -------------------------------------------- */

/**
 * Gets a DiceQuantities object from given values.
 * @param {number}   attribute     The attribute's size
 * @param {number}  [skill=0]      The skill's size
 * @param {number}  [rof=0]        The RoF's value
 * @param {number}  [modifier=0]   The task modifier
 * @param {boolean} [locate=false] Whether to roll a Location die
 * @see {YearZeroRoll}
 * @returns {Array.<import('../lib/yzur.js').TermBlok>}
 */
export function getDiceQuantities(attribute, skill = 0, rof = 0, locate = false) {
  const dice = [];
  if (attribute > 0) dice.push({ term: attribute, number: 1 });
  if (skill > 0) dice.push({ term: skill, number: 1 });
  if (rof > 0) dice.push({ term: 'm', number: rof });
  if (locate) dice.push({ term: 'l', number: 1 });
  return dice;
}
/* ------------------------------------------- */

/**
 * Gets the Actor which is the source of a roll.
 * @param {string} [actorId]
 * @param {string} [tokenKey]
 * @return {Actor}
 */
export function getRollingActor({ actorId, tokenKey } = {}) {
  // Case 1 — A Synthetic Actor from a Token
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
  return game.actors.get(actorId);
}

/* -------------------------------------------- */
/*  Dice So Nice Registration                   */
/* -------------------------------------------- */
// https://gitlab.com/riccisi/foundryvtt-dice-so-nice/-/wikis/API/Customization

export function registerDsN(dice3d) {
  dice3d.addSystem({
    id: 'fvtt-yze-generic-stepped',
    name: 'Year Zero Engine - Generic Stepped Dice',
  }, 'preferred');

  dice3d.addColorset({
    name: 'yzegs-base',
    category: 'Year Zero Engine - Generic Stepped Dice',
    description: 'YZEGS Base Die',
    foreground: '#E2C45F', // '#cfa826', // '#E2C45F',
    background: '#4E5B31', // '#262c23', // '#4C5847', // '#44544c',
    outline: 'none',
    // edge: '#000',
    texture: 'none',
    material: 'metal',
    font: 'Nunito Sans',
  }, 'default');

  dice3d.addColorset({
    name: 'yzegs-ammo',
    category: 'Year Zero Engine - Generic Stepped Dice',
    description: 'YZEGS Ammo Die',
    foreground: '#000',
    background: '#A3904D', // '#726435', // '#A3904D',
    outline: 'none',
    // edge: '#000',
    texture: 'bronze01',
    material: 'metal',
    font: 'Nunito Sans',
    fontScale: { dm: 0.75, d6: 0.75 },
  }, 'default');

  dice3d.addColorset({
    name: 'yzegs-loc',
    category: 'Year Zero Engine - Generic Stepped Dice',
    description: 'YZEGS Hit Location Die',
    foreground: '#000',
    background: '#fff', // '#9b978e', // '#DED8CC',
    outline: 'none',
    // edge: '#000',
    texture: 'none',
    material: 'glass',
    font: 'Nunito Sans',
  }, 'default');

  dice3d.addDicePreset({
    type: 'd6',
    labels: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d6/yzegs_d6_1_dsn.png',
      '2',
      '3',
      '4',
      '5',
      'systems/fvtt-yze-generic-stepped/assets/dice/d6/yzegs_d6_6_dsn.png',
    ],
    // eslint-disable-next-line no-sparse-arrays
    bumpMaps: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d6/yzegs_d6_1_dsn_bump.png',,,,,
      'systems/fvtt-yze-generic-stepped/assets/dice/d6/yzegs_d6_6_dsn_bump.png',
    ],
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-base',
  }, 'd6');

  dice3d.addDicePreset({
    type: 'd8',
    labels: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_1_dsn.png',
      '2',
      '3',
      '4',
      '5',
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_6_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_7_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_8_dsn.png',
    ],
    // eslint-disable-next-line no-sparse-arrays
    bumpMaps: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_1_dsn_bump.png',,,,,
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_6_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_7_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d8/yzegs_d8_8_dsn_bump.png',
    ],
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-base',
  }, 'd8');

  dice3d.addDicePreset({
    type: 'd10',
    labels: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_1_dsn.png',
      '2',
      '3',
      '4',
      '5',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_6_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_7_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_8_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_9_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_10_dsn.png',
    ],
    // eslint-disable-next-line no-sparse-arrays
    bumpMaps: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_1_dsn_bump.png',,,,,
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_6_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_7_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_8_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_9_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d10/yzegs_d10_10_dsn_bump.png',
    ],
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-base',
  }, 'd10');

  dice3d.addDicePreset({
    type: 'd12',
    labels: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_1_dsn.png',
      '2',
      '3',
      '4',
      '5',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_6_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_7_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_8_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_9_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_10_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_11_dsn.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_12_dsn.png',
    ],
    // eslint-disable-next-line no-sparse-arrays
    bumpMaps: [
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_1_dsn_bump.png',,,,,
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_6_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_7_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_8_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_9_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_10_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_11_dsn_bump.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/d12/yzegs_d12_12_dsn_bump.png',
    ],
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-base',
  }, 'd12');

  dice3d.addDicePreset({
    type: 'dm',
    labels: [
      'systems/fvtt-yze-generic-stepped/assets/dice/dm/yzegs_dm_1_dsn.png',
      '2',
      '3',
      '4',
      '5',
      'systems/fvtt-yze-generic-stepped/assets/dice/dm/yzegs_dm_6_dsn.png',
    ],
    // eslint-disable-next-line no-sparse-arrays
    bumpMaps: [
      'systems/fvtt-yze-generic-stepped/assets/dice/dm/yzegs_dm_1_dsn.png',,,,,
      'systems/fvtt-yze-generic-stepped/assets/dice/dm/yzegs_dm_6_dsn.png',
    ],
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-ammo',
  }, 'd6');

  dice3d.addDicePreset({
    type: 'dl',
    labels: [
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_L.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_T.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_T.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_T.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_A.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_H.png',
    ],
    bumpMaps: [
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_L.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_T.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_T.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_T.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_A.png',
      'systems/fvtt-yze-generic-stepped/assets/dice/dl/hit_H.png',
    ],
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-loc',
  }, 'd6');

  dice3d.addDicePreset({
    type: 'd2',
    labels: range(2),
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-ammo',
  }, 'd2');

  dice3d.addDicePreset({
    type: 'd4',
    labels: range(4),
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-base',
  }, 'd4');

  dice3d.addDicePreset({
    type: 'd100',
    labels: ['10', '20', '30', '40', '50', '60', '70', '80', '90', '00'],
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-base',
  }, 'd100');

  dice3d.addDicePreset({
    type: 'd20',
    labels: range(20),
    system: 'fvtt-yze-generic-stepped',
    colorset: 'yzegs-base',
  }, 'd20');
}
