import { YZEGS } from './config';
import { getActiveActor } from '@utils/get-actor';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { getSkillCombatType } from './combat-modifiers.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';
const LEGACY_SYSTEM_MACRO_FOLDER = 'YZE Stepped Dice Roll Macros';
export const MACRO_FOLDER_CLEANUP_SETTING = 'macroFolderCleanupComplete';

/**
 * Creates a Macro from an Item or stat (attribute/skill) drop.
 * Gets an existing item macro if one exists, otherwise create a new one.
 * ! Do not return a Promise or conflict with Foundry's default drop
 * @param {Object} data The dropped data
 * @param {number} slot The hotbar slot to use
 */
export function createYZEGSMacro(data, slot) {
  if (data.type === 'Stat') {
    // ! Do not use await or conflict with Foundry
    _createYZEGSStatMacro(data, slot);
    return false;
  }
  // TODO
  // if (data.type === 'Action') {
  //   _createYZEGSActionMacro(data, slot);
  //   return false;
  // }
  if (data.type === 'Item' && typeof data.uuid === 'string') {
    if (!data.uuid.includes('Actor') && !data.uuid.includes('Token')) return;

    // ! Use synced method or conflict with Foundry
    // eslint-disable-next-line no-undef
    const item = fromUuidSync(data.uuid);
    if (!item) return;
    // if (!item.system.rollable) return;

    // ! Do not use await or conflict with Foundry
    _createYZEGSItemMacro(item, slot);
    return false;
  }
}

/** Remove the obsolete system Macro folder once, but only when it is empty. */
export async function removeEmptySystemMacroFolder() {
  if (!game.user.isGM || game.settings.get(SYSTEM_ID, MACRO_FOLDER_CLEANUP_SETTING)) return;

  try {
    const folder = game.folders.find(candidate => (
      candidate.type === 'Macro' && candidate.name === LEGACY_SYSTEM_MACRO_FOLDER
    ));
    if (folder && !folder.contents?.length && !folder.children?.length) await folder.delete();
    await game.settings.set(SYSTEM_ID, MACRO_FOLDER_CLEANUP_SETTING, true);
  }
  catch (error) {
    console.error('YZEGS | Empty Macro folder cleanup failed.', error);
  }
}

/* ------------------------------------------ */
/*  Hotbar Macros                             */
/* ------------------------------------------ */

async function _createYZEGSStatMacro(data, slot) {
  const command = `game.yzegs.macros.rollStat("${data.attribute}"`
    + (data.skill ? `, "${data.skill}"` : '')
    + ');';
  const actor = await fromUuid(data.uuid);
  if (!actor) return;
  const skill = data.skill ? actor.getSkill(data.skill) : null;

  const commandName = game.i18n.format('YZEGS.MACRO.RollStat', {
    stat: skill?.name ?? game.i18n.localize(`YZEGS.AttributeNames.${data.attribute}`),
  });

  let macro = findMacro(commandName, command);
  if (!macro) {
    macro = await Macro.create({
      name: commandName,
      type: 'script',
      img: 'icons/svg/dice-target.svg',
      command: command,
      flags: { 'fvtt-yze-generic-stepped': { statMacro: true } },
      'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    });
  }
  game.user.assignHotbarMacro(macro, slot);
}

async function _createYZEGSItemMacro(item, slot) {
  const command = `game.yzegs.macros.rollItem("${item.name}");`;
  let macro = findMacro(item.name, command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'fvtt-yze-generic-stepped': { itemMacro: true } },
      'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    });
  }
  game.user.assignHotbarMacro(macro, slot);
}

/* ------------------------------------------ */

/**
 * Rolls a stat.
 * @param {string} attributeKey
 * @param {string} skillKey
 * @param {Object} options
 */
export async function rollStat(attributeKey, skillKey = null, options = {}) {
  const actor = await getActiveActor();
  if (!actor) return null;

  const attribute = actor.system.attributes?.[attributeKey]?.value ?? 0;
  const skillItem = skillKey ? actor.getSkill(skillKey) : null;
  const skill = skillItem?.system.value ?? 0;
  const title = options.title ?? (skillItem?.name || game.i18n.localize(YZEGS.attributes[attributeKey]));
  return YZEGSRoller.taskCheck({
    ...options,
    actor,
    title,
    attributeName: attributeKey,
    skillName: skillItem?.id ?? null,
    combatType: getSkillCombatType(skillItem),
    attribute,
    skill,
  });
}

/* ------------------------------------------ */

/**
 * Performs an action.
 * @param {string} actionKey
 */
export async function rollAction(actionKey) {
  const skillKey = YZEGS.actionSkillsMap[actionKey];
  if (!skillKey) return null;
  const actor = await getActiveActor();
  if (!actor) return null;

  const skill = actor.getSkill(skillKey);
  if (!skill) return null;
  const statData = getAttributeAndSkill(skill, actor);
  return YZEGSRoller.taskCheck({
    ...statData,
    actor,
    rof: ['rangedCombat', 'heavyWeapons'].includes(skillKey) ? 6 : 0,
  });
}

/* ------------------------------------------ */

/**
 * Rolls an item.
 * @param {string} itemName
 */
export async function rollItem(itemName) {
  const actor = await getActiveActor();

  // Gets matching items.
  const items = actor ? actor.items.filter(i => i.name === itemName) : [];
  if (items.length > 1) {
    ui.notifications.warn(game.i18n.format('YZEGS.MACRO.MultipleItems', {
      actor: actor.name,
      item: itemName,
    }));
  }
  else if (items.length === 0) {
    return ui.notifications.warn(game.i18n.format('YZEGS.MACRO.NoItem', {
      actor: actor?.name ?? game.i18n.localize('YZEGS.Dialog.Actor.ChooseActor'),
      item: itemName,
    }));
  }

  return items[0].roll({ actor });
}

/* ------------------------------------------ */

/**
 * Opens a generic RollTable picker and draws the requested number of results.
 */
export async function rollOnTable() {
  const tables = [...game.tables].sort((a, b) => a.name.localeCompare(b.name));
  if (!tables.length) {
    return ui.notifications.warn('There are no Rollable Tables in this world.');
  }

  const options = tables.map(optionTable => (
    `<option value="${optionTable.id}">${foundry.utils.escapeHTML(optionTable.name)}</option>`
  )).join('');
  const data = await foundry.applications.api.DialogV2.input({
    window: { title: 'Roll on a Table' },
    content: `
      <div class="form-group">
        <label>Table</label>
        <select name="tableId">${options}</select>
      </div>
      <div class="form-group">
        <label>Number of draws</label>
        <input type="number" name="draws" value="1" min="1" max="5" step="1">
      </div>
      <div class="form-group">
        <label>Private</label>
        <input type="checkbox" name="private">
      </div>
    `,
    ok: { label: 'Roll' },
  });
  if (!data) return null;

  const table = game.tables.get(data.tableId);
  if (!table) return ui.notifications.error('The selected Rollable Table no longer exists.');
  const draws = Math.clamp(Math.floor(Number(data.draws) || 1), 1, 5);
  return table.drawMany(draws, {
    messageMode: data.private ? 'self' : undefined,
  });
}

/* ------------------------------------------ */

/**
 * Draws a card-like result from a named RollTable.
 * @param {string} tableName
 */
export async function drawTableCard(tableName) {
  const table = game.tables.getName(tableName);
  if (!table) {
    return ui.notifications.error(`Could not find the "${tableName}" Rollable Table.`);
  }

  const draw = await table.draw();
  if (draw.results.length) return draw;
  await table.resetResults();
  return ui.notifications.info(`The ${table.name} table was empty and has been reset.`);
}

/* ------------------------------------------ */

/**
 * Draws one or more results from the Initiative RollTable for the selected token.
 * @param {string} [tableName='Initiative']
 */
export async function drawInitiative(tableName = 'Initiative') {
  const token = canvas.tokens.controlled[0];
  if (!token || !token.isOwner) {
    return ui.notifications.error('Select a token you control before drawing initiative.');
  }

  let combat = game.combat;
  if (!combat) {
    if (!game.user.isGM) return ui.notifications.error('Start a combat encounter first.');
    const initiativeTable = game.tables.getName(tableName);
    await initiativeTable?.resetResults();
    await token.document.toggleCombatant();
    combat = game.combat;
  }
  else if (!token.inCombat) {
    await token.document.toggleCombatant();
  }

  const combatant = combat?.getCombatantByToken(token.id);
  if (!combatant) return ui.notifications.error('Could not add the selected token to combat.');

  if (combatant.initiative !== null) {
    const redraw = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Redraw Initiative?' },
      content: '<p>This combatant already has an Initiative value. Draw again?</p>',
      yes: { default: true },
      no: { default: false },
    });
    if (!redraw) return null;
  }

  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: 'Draw Initiative' },
    content: `
      <div class="form-group">
        <label>Number of cards</label>
        <select name="count">
          <option value="1">One</option>
          <option value="2">Two</option>
          <option value="3">Three</option>
        </select>
      </div>
    `,
    ok: { label: 'Draw' },
  });
  if (!choice) return null;

  const table = game.tables.getName(tableName);
  if (!table) return ui.notifications.error(`Could not find the "${tableName}" Initiative table.`);
  const count = Math.clamp(Math.floor(Number(choice.count) || 1), 1, 3);
  if (table.results.filter(result => !result.drawn).length < count) {
    ui.notifications.warn('There are not enough Initiative cards left. The deck has been reset.');
    await table.resetResults();
  }

  const { results } = await table.drawMany(count, { displayChat: false });
  if (!results.length) return ui.notifications.error('No Initiative card could be drawn.');

  let selected = results[0];
  if (results.length > 1) {
    const selectedId = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Choose Initiative' },
      content: '<p>Choose the Initiative card to keep.</p>',
      buttons: results.map(result => ({
        action: result.id,
        label: result.text,
        callback: () => result.id,
      })),
    });
    selected = results.find(result => result.id === selectedId);
    if (!selected) {
      await table.updateEmbeddedDocuments('TableResult', results.map(result => ({
        _id: result.id,
        drawn: false,
      })), { diff: false });
      return null;
    }

    const returned = results.filter(result => result.id !== selected.id);
    await table.updateEmbeddedDocuments('TableResult', returned.map(result => ({
      _id: result.id,
      drawn: false,
    })), { diff: false });
  }

  const initiative = selected.range[0];
  await combat.setInitiative(combatant.id, initiative);
  const images = results.map(result => {
    const chosen = result.id === selected.id ? ' style="outline: 3px solid #000"' : '';
    const text = foundry.utils.escapeHTML(String(result.text));
    const img = result.img ? foundry.utils.escapeHTML(result.img) : null;
    if (img) return `<img src="${img}" alt="${text}" width="65"${chosen}>`;
    return `<strong${chosen}>${text}</strong>`;
  }).join(' ');
  const selectedText = foundry.utils.escapeHTML(String(selected.text));
  return ChatMessage.create({
    flavor: results.length > 1
      ? `Drew ${results.length} Initiative cards and chose ${selectedText}.`
      : `Drew Initiative ${selectedText}.`,
    content: `<p style="text-align:center">${images}</p>`,
    speaker: ChatMessage.getSpeaker({ token: token.document }),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

/* ------------------------------------------ */
/*  Utilities                                 */
/* ------------------------------------------ */

export function findMacro(commandName, command) {
  return game.macros.find(m => (
    m.name === commandName &&
    m.command === command &&
    (
      m.author === game.user.id ||
      m.ownership.default >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER ||
      m.ownership[game.user.id] >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    )
  ));
}
