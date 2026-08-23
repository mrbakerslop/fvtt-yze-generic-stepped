/* eslint-disable no-unused-vars */
/* ============================================================================
 * YEAR ZERO ENGINE - GENERIC STEPPED DICE
 * Originally derived from the Twilight: 2000 Foundry VTT system.
 * See README.md for acknowledgements and license notices.
 * ============================================================================
 * Source Code License: GPL-3.0-or-later
 *
 * Foundry License: Foundry Virtual Tabletop End User License Agreement
 *   https://foundryvtt.com/article/license/
 *
 * ============================================================================
 */

// Imports Modules.
import { YZEGS } from './system/config.js';
import { registerDsN, YZEGSRoller } from './components/roll/dice.js';
import { registerSystemSettings } from './system/settings.js';
import { registerStatusEffects, repairStatusEffectIcons } from './system/statusEffects.js';
import { registerDataModels } from './system/data-models.js';
import { enrichTextEditors } from './system/enricher.js';
import { preloadHandlebarsTemplates, registerHandlebars } from './system/handlebars.js';
import {
  createYZEGSMacro,
  drawInitiative,
  drawTableCard,
  rollAction,
  rollItem,
  rollOnTable,
  rollStat,
  removeEmptySystemMacroFolder,
} from './system/macros.js';
import displayMessages from './components/message-system.js';
// import * as Chat from './components/chat/chat.js';
import ChatMessageYZEGS from './components/chat/chat.js';

// Imports Documents.
import ActorYZEGS from './actor/actor.js';
import ItemYZEGS from './item/item.js';

// Imports Applications.
import ActorSheetYZEGSCharacter from './actor/character/characterSheet.js';
import ActorSheetYZEGSVehicle from './actor/vehicle/vehicleSheet.js';
import ActorSheetYZEGSUnit from './actor/unit/unitSheet.js';
import ActorSheetYZEGSParty from './actor/party/partySheet.js';
import ActorSheetYZEGSContainer from './actor/container/containerSheet.js';
import ItemSheetYZEGS from './item/itemSheet.js';

// Imports Helpers.
import { checkMigration } from './system/migration.js';
import { migrateLegacySkills, removeMigratedWorldSkills } from './system/skill-migration.js';
import * as YZUR from './lib/yzur.js';
import * as Experience from './system/experience.js';
import * as Archetypes from './system/archetypes.js';
import { migrateAdvancementItemSource } from './system/experience-config.js';
import { resetCombatantActions } from './system/combat-actions.js';
import { registerDefenseSocket } from './system/defense-workflows.js';
import {
  advanceCombatSuppression,
  clearCombatantSuppression,
  clearCombatSuppression,
  registerSuppressionSocket,
} from './system/suppression-workflows.js';
import {
  clearCombatEngagements,
  registerUrbanSocket,
  restoreHuggingWallCover,
} from './system/urban-workflows.js';
import { registerSceneGridHooks } from './system/scene-grid.js';
import { registerMinefieldRegionBehavior } from './system/minefield-region.js';
import { registerWaterRegionBehavior } from './system/water-region.js';
import { registerHazardRegionBehavior } from './system/hazard-region.js';
import { registerTacticalTerrainRegionBehavior } from './system/tactical-terrain-region.js';
import { advanceCombatWaterHazards } from './system/water-environment.js';
import {
  advanceCombatWatercraft,
  advanceWorldTimeWatercraft,
} from './system/watercraft-workflows.js';
import { advanceGuidedImpacts } from './system/guided-weapons.js';
import { registerSocialConflictSocket } from './system/social-conflict-workflows.js';
import {
  advanceCriticalInjuryCombat,
  advanceCriticalInjuryWorldTime,
  handleCriticalCombatEnd,
  initializeCriticalStates,
  initializeOwnedInjury,
  synchronizeCriticalEffects,
  synchronizeIncapacitation,
} from './system/critical-injuries.js';
import * as Initiative from './system/initiative-workflows.js';
import CombatYZEGS from './system/combat.js';
import { recordCombatMovement } from './system/combat-edge-workflows.js';
import { advanceLandVehicleWorldTime } from './system/land-vehicle-damage.js';
import {
  advanceDiseaseWorldTime,
  initializeDiseaseStates,
  initializeOwnedDisease,
} from './system/disease-workflows.js';
import {
  advanceCombatFire,
  advanceEnvironmentalWorldTime,
  synchronizeConditionTimers,
} from './system/environmental-hazards.js';

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once('init', function () {
  console.log(`YZEGS | Initializing the Year Zero Engine - Generic Stepped Dice game system\n${YZEGS.ASCII}`);

  // Registers dice.
  YZUR.YearZeroRollManager.register('yzegs', {
    'Roll.chatTemplate': 'systems/fvtt-yze-generic-stepped/templates/components/roll/roll.hbs',
    'Roll.tooltipTemplate': 'systems/fvtt-yze-generic-stepped/templates/components/roll/tooltip.hbs',
    'Roll.infosTemplate': 'systems/fvtt-yze-generic-stepped/templates/components/roll/infos.hbs',
    'Chat.showInfos': true,
    'Icons.yzegs.ammo.6': '<img src="systems/fvtt-yze-generic-stepped/assets/icons/bullet2.png"/>',
  });
  // console.warn(CONFIG.Dice.terms);
  game.yzur = YZUR;

  // Creates a namespace within the game global.
  // Places our classes in their own namespace for later reference.
  game.yzegs = {
    applications: {
      ActorSheetYZEGSCharacter,
      ActorSheetYZEGSVehicle,
      ActorSheetYZEGSUnit,
      ActorSheetYZEGSParty,
      ActorSheetYZEGSContainer,
      ItemSheetYZEGS,
    },
    config: YZEGS,
    entities: {
      ActorYZEGS,
      ItemYZEGS,
    },
    macros: {
      drawInitiative,
      drawTableCard,
      rollAction,
      rollItem,
      rollOnTable,
      rollStat,
    },
    roller: YZEGSRoller,
    experience: Experience,
    archetypes: Archetypes,
    initiative: Initiative,
  };

  // Records configuration values.
  CONFIG.YZEGS = YZEGS;
  CONFIG.Actor.documentClass = ActorYZEGS;
  CONFIG.Item.documentClass = ItemYZEGS;
  CONFIG.Combat.documentClass = CombatYZEGS;
  registerDataModels();
  registerMinefieldRegionBehavior();
  registerWaterRegionBehavior();
  registerHazardRegionBehavior();
  registerTacticalTerrainRegionBehavior();

  // Patches Core functions.
  CONFIG.Combat.initiative = {
    formula: '1d10',
    decimals: 0,
  };

  // Registers fonts.
  CONFIG.fontDefinitions['Nunito Sans'] = {
    editor: true,
    fonts: [
      { urls: ['systems/fvtt-yze-generic-stepped/fonts/NunitoSans-ExtraBold.woff'], weight: 800 },
    ],
  };
  CONFIG.fontDefinitions.Mukta = {
    editor: true,
    fonts: [
      { urls: ['systems/fvtt-yze-generic-stepped/fonts/Mukta-Medium.woff'], weight: 500 },
      { urls: ['systems/fvtt-yze-generic-stepped/fonts/Mukta-Bold.woff'], weight: 700 },
    ],
  };
  // Registers sheet application classes.
  // This will stop using the core sheets and instead use our customized versions.
  const documentSheets = foundry.applications.apps.DocumentSheetConfig;
  documentSheets.registerSheet(ActorYZEGS, 'fvtt-yze-generic-stepped', ActorSheetYZEGSCharacter, {
    types: ['character', 'npc'],
    makeDefault: true,
    label: 'YZEGS.SheetClassCharacter',
  });
  documentSheets.registerSheet(ActorYZEGS, 'fvtt-yze-generic-stepped', ActorSheetYZEGSVehicle, {
    types: ['vehicle'],
    makeDefault: true,
    label: 'YZEGS.SheetClassVehicle',
  });
  documentSheets.registerSheet(ActorYZEGS, 'fvtt-yze-generic-stepped', ActorSheetYZEGSUnit, {
    types: ['unit'],
    makeDefault: true,
    label: 'YZEGS.SheetClassUnit',
  });
  documentSheets.registerSheet(ActorYZEGS, 'fvtt-yze-generic-stepped', ActorSheetYZEGSParty, {
    types: ['party'],
    makeDefault: true,
    label: 'YZEGS.SheetClassParty',
  });
  documentSheets.registerSheet(ActorYZEGS, 'fvtt-yze-generic-stepped', ActorSheetYZEGSContainer, {
    types: ['container'],
    makeDefault: true,
    label: 'YZEGS.SheetClassContainer',
  });

  documentSheets.registerSheet(ItemYZEGS, 'fvtt-yze-generic-stepped', ItemSheetYZEGS, { makeDefault: true });

  registerSystemSettings();
  registerSceneGridHooks();
  enrichTextEditors();
  registerHandlebars();
  preloadHandlebarsTemplates();

  // Defines custom YZEGS status effects.
  registerStatusEffects();
});

Hooks.once('ready', async function () {
  registerDefenseSocket();
  registerSuppressionSocket();
  registerUrbanSocket();
  registerSocialConflictSocket();
  Initiative.registerInitiativeSocket();
  await repairStatusEffectIcons();
  await initializeCriticalStates();
  await initializeDiseaseStates();
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to.
  Hooks.on('hotbarDrop', (_bar, data, slot) => createYZEGSMacro(data, slot));

  // Determines whether a system migration is required and feasible.
  await checkMigration();
  await migrateAdvancementItemSource();
  await migrateLegacySkills();
  await removeMigratedWorldSkills();
  await removeEmptySystemMacroFolder();

  // Displays starting messages.
  displayMessages();

  console.log('YZEGS | Ready!');
  Hooks.callAll('yzegsReady', game.yzegs, CONFIG.YZEGS);
});

/* -------------------------------------------- */
/*  Foundry VTT Hooks                           */
/* -------------------------------------------- */

Hooks.once('diceSoNiceReady', dice3d => registerDsN(dice3d));

/* -------------------------------------------- */

Hooks.on('renderChatMessageHTML', (app, html, data) => {
  ChatMessageYZEGS.addChatListeners(html);
  // Hides chat action buttons.
  ChatMessageYZEGS.hideChatActionButtons(html);

  // Automatically closes dice results tooltips.
  // let delay = game.settings.get('fvtt-yze-generic-stepped', 'closeRollTooltipDelay');
  // console.log('delay: ', delay);
  // if (delay >= 0) {
  //   delay = Math.min(delay, 15 * 60);
  //   ChatMessageYZEGS.closeRollTooltip(html, delay * 1000);
  // }
});

/* -------------------------------------------- */

Hooks.on('updateCombat', async (combat, changes, _options, userId) => {
  try {
    await resetCombatantActions(combat, changes, userId);
    await advanceCombatSuppression(combat, changes, userId);
    await restoreHuggingWallCover(combat, changes, userId);
    await advanceCombatWaterHazards(combat, changes, userId);
    await advanceCombatFire(combat, changes, userId);
    await advanceCombatWatercraft(combat, changes, userId);
    await advanceGuidedImpacts(combat, changes, userId);
    if (Object.hasOwn(changes, 'turn') || Object.hasOwn(changes, 'round')) {
      await advanceCriticalInjuryCombat(combat, changes, userId);
    }
    if (Object.hasOwn(changes, 'turn') && game.user.isGM && userId === game.user.id) {
      const actor = combat.combatant?.actor;
      if (actor?.statuses?.has?.('overwatch')) {
        await actor.toggleStatusEffect('overwatch', { active: false });
        await actor.unsetFlag('fvtt-yze-generic-stepped', 'actionOverwatch');
      }
    }
  }
  catch (error) {
    console.error('yzegs | Failed to reset combatant actions for the new round.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.CombatActions.ResetFailed'));
  }
});

Hooks.on('deleteCombat', async (combat, _options, userId) => {
  try {
    await clearCombatSuppression(combat, userId);
    await clearCombatEngagements(combat, userId);
    await handleCriticalCombatEnd(combat, userId);
    await Initiative.clearCombatInitiativeState(combat, userId);
  }
  catch (error) {
    console.error('yzegs | Failed to clear suppression when combat ended.', error);
  }
});

Hooks.on('renderCombatTracker', (_app, html) => {
  Initiative.activateInitiativeTrackerControls(html instanceof HTMLElement ? html : html?.[0]);
});

Hooks.on('preUpdateCombatant', Initiative.enforceUniqueInitiative);
Hooks.on('updateToken', recordCombatMovement);

Hooks.on('createItem', async (item, _options, userId) => {
  if (userId !== game.user.id || !item.parent) return;
  if (item.type === 'injury') {
    await initializeOwnedInjury(item.parent, item);
    await synchronizeCriticalEffects(item.parent);
  }
  else if (item.type === 'disease') await initializeOwnedDisease(item.parent, item);
});

Hooks.on('updateItem', async (item, changes, _options, userId) => {
  if (userId !== game.user.id || item.type !== 'injury' || !item.parent) return;
  if (foundry.utils.getProperty(changes, 'system.effects') !== undefined
    || foundry.utils.getProperty(changes, 'system.state.active') !== undefined) {
    await synchronizeCriticalEffects(item.parent);
  }
});

Hooks.on('deleteItem', async (item, _options, userId) => {
  if (userId !== game.user.id || item.type !== 'injury' || !item.parent) return;
  await synchronizeCriticalEffects(item.parent);
});

Hooks.on('updateWorldTime', advanceWorldTimeWatercraft);
Hooks.on('updateWorldTime', advanceCriticalInjuryWorldTime);
Hooks.on('updateWorldTime', advanceLandVehicleWorldTime);
Hooks.on('updateWorldTime', advanceDiseaseWorldTime);
Hooks.on('updateWorldTime', advanceEnvironmentalWorldTime);

Hooks.on('deleteCombatant', async (combatant, _options, userId) => {
  try {
    await clearCombatantSuppression(combatant, userId);
  }
  catch (error) {
    console.error('yzegs | Failed to clear suppression from a removed combatant.', error);
  }
});

Hooks.on('createActiveEffect', async (effect, _options, userId) => {
  if (userId !== game.user.id || !effect.statuses?.has?.('suppressed')) return;
  const actor = effect.parent;
  if (!actor?.statuses?.has?.('overwatch')) return;
  await actor.toggleStatusEffect('overwatch', { active: false });
  await actor.unsetFlag('fvtt-yze-generic-stepped', 'actionOverwatch');
});

Hooks.on('deleteActiveEffect', async (effect, _options, userId) => {
  if (userId !== game.user.id || !effect.statuses?.has?.('suppressed')) return;
  const actor = effect.parent;
  if (actor?.getFlag('fvtt-yze-generic-stepped', 'suppressionTurn')) {
    await actor.unsetFlag('fvtt-yze-generic-stepped', 'suppressionTurn');
  }
});

Hooks.on('updateActor', async (actor, changes, _options, userId) => {
  if (userId !== game.user.id || !['character', 'npc'].includes(actor.type)) return;
  const health = foundry.utils.getProperty(changes, 'system.health.value');
  const sanity = foundry.utils.getProperty(changes, 'system.sanity.value');
  try {
    await synchronizeConditionTimers(actor, changes);
    if (health !== undefined && actor.statuses?.has?.('overwatch')) {
      await actor.toggleStatusEffect('overwatch', { active: false });
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'actionOverwatch');
    }
    if (Number(health) > 0 && actor.getFlag('fvtt-yze-generic-stepped', 'actionFirstAidAttempts')) {
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'actionFirstAidAttempts');
    }
    if (Number(sanity) > 0 && actor.getFlag('fvtt-yze-generic-stepped', 'actionRallyAttempts')) {
      await actor.unsetFlag('fvtt-yze-generic-stepped', 'actionRallyAttempts');
    }
    if (health !== undefined || sanity !== undefined) await synchronizeIncapacitation(actor);
  }
  catch (error) {
    console.error('yzegs | Failed to clear recovery action history.', error);
  }
});

/* -------------------------------------------- */

Hooks.on('createToken', (token, _data, _userId) => {
  // When creating a Unit token.
  if (token.actor.type === 'unit') {
    const updateData = {};

    // Uses abbreviation (info) in place of name.
    const nm = token.actor.system.info;
    if (nm) updateData.name = nm;

    // Uses default affiliation.
    const afl = token.actor.system.unitAffiliation;
    if (afl) {
      let disposition;
      switch (afl) {
        case 'friendly':
          disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
          break;
        case 'hostile':
          disposition = CONST.TOKEN_DISPOSITIONS.HOSTILE;
          break;
        case 'neutral':
          disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL;
          break;
        default:
          disposition = CONST.TOKEN_DISPOSITIONS.HOSTILE;
      }
      if (disposition !== token.disposition) updateData.disposition = disposition;
    }

    // Updates the token.
    if (!foundry.utils.isEmpty(updateData)) {
      token.update(updateData);
    }
  }
});
