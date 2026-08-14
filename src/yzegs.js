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
import { registerStatusEffects } from './system/statusEffects.js';
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
  setupMacroFolder,
} from './system/macros.js';
import displayMessages from './components/message-system.js';
// import * as Chat from './components/chat/chat.js';
import ChatMessageYZEGS, { addChatMessageContextOptions } from './components/chat/chat.js';

// Imports Documents.
import ActorYZEGS from './actor/actor.js';
import ItemYZEGS from './item/item.js';

// Imports Applications.
import ActorSheetYZEGSCharacter from './actor/character/characterSheet.js';
import ActorSheetYZEGSVehicle from './actor/vehicle/vehicleSheet.js';
import ActorSheetYZEGSUnit from './actor/unit/unitSheet.js';
import ActorSheetYZEGSParty from './actor/party/partySheet.js';
import ItemSheetYZEGS from './item/itemSheet.js';

// Imports Helpers.
import { checkMigration } from './system/migration.js';
import { migrateLegacySkills, removeMigratedWorldSkills } from './system/skill-migration.js';
import * as YZUR from './lib/yzur.js';
import * as Experience from './system/experience.js';

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
  };

  // Records configuration values.
  CONFIG.YZEGS = YZEGS;
  CONFIG.Actor.documentClass = ActorYZEGS;
  CONFIG.Item.documentClass = ItemYZEGS;
  registerDataModels();

  // Patches Core functions.
  CONFIG.Combat.initiative = {
    formula: '1d10 + (@attributes.agl.value / 100)',
    decimals: 2,
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

  documentSheets.registerSheet(ItemYZEGS, 'fvtt-yze-generic-stepped', ItemSheetYZEGS, { makeDefault: true });

  registerSystemSettings();
  enrichTextEditors();
  registerHandlebars();
  preloadHandlebarsTemplates();

  // Defines custom YZEGS status effects.
  registerStatusEffects();
});

Hooks.once('ready', async function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to.
  setupMacroFolder();
  Hooks.on('hotbarDrop', (_bar, data, slot) => createYZEGSMacro(data, slot));

  // Determines whether a system migration is required and feasible.
  await checkMigration();
  await migrateLegacySkills();
  await removeMigratedWorldSkills();

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
  // addChatMessageContextOptions(html);

  // Automatically closes dice results tooltips.
  // let delay = game.settings.get('fvtt-yze-generic-stepped', 'closeRollTooltipDelay');
  // console.log('delay: ', delay);
  // if (delay >= 0) {
  //   delay = Math.min(delay, 15 * 60);
  //   ChatMessageYZEGS.closeRollTooltip(html, delay * 1000);
  // }
});

/* -------------------------------------------- */

Hooks.on('getChatMessageContextOptions', (_app, options) => addChatMessageContextOptions(options));


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
