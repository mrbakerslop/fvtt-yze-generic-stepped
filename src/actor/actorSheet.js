import { YZEGS } from '../system/config.js';
import YZEGSDialog from '../components/dialog/dialog.js';
import { getAttributeAndSkill, YZEGSRoller } from '../components/roll/dice.js';
import { enrichTextFields } from '@utils/utils.js';
import { activateRatingMenus } from '../components/rating-menu.js';
import { activateCheckboxControls } from '../components/checkbox-control.js';
import {
  getRadiationLabel,
  isRadiationEnabled,
  NOTES_TAB_SETTING,
} from '../system/settings.js';

/**
 * Year Zero Engine - Generic Stepped Dice Actor Sheet.
 * @extends {foundry.applications.sheets.ActorSheetV2} Extends the V2 ActorSheet
 */
export default class ActorSheetYZEGS extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
) {
  /* ------------------------------------------- */
  /*  Sheet Properties                           */
  /* ------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['yzegs', 'actor'],
    position: { width: 570, height: 715 },
    window: { resizable: true, contentClasses: ['flexcol'] },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    sheet: { template: '' },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: 'main' },
        { id: 'combat' },
        { id: 'equipment' },
        { id: 'biography' },
        { id: 'experience' },
        { id: 'description' },
      ],
      initial: 'main',
    },
  };

  /** @override */
  get template() {
    if (this.actor.type === 'npc') {
      return 'systems/fvtt-yze-generic-stepped/templates/actor/character/character-sheet.hbs';
    }
    return `systems/fvtt-yze-generic-stepped/templates/actor/${this.actor.type}/${this.actor.type}-sheet.hbs`;
  }

  /** @override */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.sheet.template = this.template;
    return parts;
  }

  /* ------------------------------------------- */
  /*  Sheet Data Preparation                     */
  /* ------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const sheetData = await super._prepareContext(options);
    const descriptionValue = this.actor.system.description ?? '';
    const notesTabEnabled = game.settings.get('fvtt-yze-generic-stepped', NOTES_TAB_SETTING);
    const notesTabId = this.actor.type === 'party' ? 'note' : 'description';
    if (!notesTabEnabled && this.tabGroups.primary === notesTabId) {
      this.tabGroups.primary = this.constructor.TABS.primary.initial;
    }
    Object.assign(sheetData, {
      owner: this.actor.isOwner,
      editable: this.isEditable,
      actor: foundry.utils.deepClone(this.actor),
      system: foundry.utils.deepClone(this.actor.system),
      descriptionValue,
      documentUuid: this.actor.uuid,
      config: YZEGS,
      notesTabEnabled,
      radiation: {
        enabled: isRadiationEnabled(),
        name: getRadiationLabel(),
      },
      hideCapacitiesButtons: !game.user.isGM && game.settings.get('fvtt-yze-generic-stepped', 'hideCapacitiesButtons'),
    });
    await enrichTextFields(sheetData, ['system.description']);
    return sheetData;
  }

  /* -------------------------------------------- */
  /*  Filtering Dropped Items                     */
  /* -------------------------------------------- */

  /** @override */
  async _onDropItem(event, data) {
    const item = await Item.implementation.fromDropData(data);
    if (!item) return false;
    const type = item.type;
    const alwaysAllowedItems = YZEGS.physicalItems;
    const allowedItems = {
      character: ['skill', 'specialty', 'injury'],
      npc: ['skill', 'specialty'],
      vehicle: [],
    };
    let allowed = true;

    if (type === 'skill') {
      const validAttribute = Object.hasOwn(YZEGS.attributes, item.system.attribute);
      const skillsSection = event.target.closest('.skills-drop-zone');
      const validActor = ['character', 'npc'].includes(this.actor.type);
      if (!validAttribute || !skillsSection || !validActor) {
        const msg = game.i18n.localize('YZEGS.ActorSheet.SkillDropHint');
        console.warn(`yzegs | ${msg}`);
        ui.notifications.warn(msg);
        return null;
      }
    }

    if (this.actor.type === 'unit') {
      allowed = false;
    }
    else if (this.actor.type === 'party') {
      allowed = false;
    }
    else if (!alwaysAllowedItems.includes(type)) {
      if (!allowedItems[this.actor.type]?.includes(type)) {
        allowed = false;
      }
    }

    if (!allowed) {
      const msg = game.i18n.format('YZEGS.ActorSheet.NotifWrongItemType', {
        type: game.i18n.localize(`YZEGS.ItemTypes.${type}`),
        actor: game.i18n.localize(`YZEGS.ActorTypes.${this.actor.type}`),
      });
      console.warn(`yzegs | ${msg}`);
      ui.notifications.warn(msg);
      return null;
    }
    return super._onDropItem(event, data);
  }

  /* -------------------------------------------- */
  /*  Actor Rolls                                 */
  /* -------------------------------------------- */

  rollAction(actionName, _itemId) {
    const skillReference = YZEGS.actionSkillsMap[actionName];
    const skill = this.actor.getSkill(skillReference);
    if (!skill) return null;
    const statData = getAttributeAndSkill(skill, this.actor);
    statData.title += ` (${this.actor.name})`;
    const isRangedSkill = ['rangedCombat', 'heavyWeapons'].includes(skillReference);
    return YZEGSRoller.taskCheck({
      ...statData,
      actor: this.actor,
      rof: isRangedSkill ? 6 : 0,
    });
  }

  /* ------------------------------------------- */
  /*  Sheet Listeners                            */
  /* ------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    activateRatingMenus(this.element);
    activateCheckboxControls(this.element, (path, value) => this.actor.update({ [path]: value }));
    const activeTab = this.element.querySelector(
      `.tabs [data-group="primary"][data-tab="${this.tabGroups.primary}"]`,
    );
    if (activeTab) this.changeTab(this.tabGroups.primary, 'primary', { force: true, updatePosition: false });

    // Editable-only Listeners
    if (!this.isEditable) return;

    // Input Focus & Update
    const inputs = html.find('input');
    inputs.focus(ev => ev.currentTarget.select());
    // inputs.addBack().find('[data-dtype="Number"]').change(this._onChangeInputDelta.bind(this));

    // Item Management
    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-edit').click(this._onItemEdit.bind(this));
    html.find('.item-chat').click(this._onItemChat.bind(this));
    html.find('.item-delete').click(this._onItemDelete.bind(this));
    html.find('.item-equip').click(this._onItemEquip.bind(this));
    html.find('.item-backpack').click(this._onItemStore.bind(this));
    // html.find('.item-mag .weapon-edit-ammo').change(this._onWeaponAmmoChange.bind(this));

    // Owner-only listeners.
    if (this.actor.isOwner) {
      html.find('.item-roll').click(this._onItemRoll.bind(this));
      html.find('.item[data-item-id]').each((_index, elem) => {
        elem.setAttribute('draggable', true);
        elem.addEventListener('dragstart', ev => this._onDragStart(ev), false);
      });
    }
  }

  /* ------------------------------------------- */

  async _onItemRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);

    // Specific item click on Vehicles.
    if (this.actor.type === 'vehicle' && item.type === 'weapon') {
      const actors = this.actor.system.crew.occupants.reduce((data, o) => {
        const a = game.actors.get(o.id);
        if (!a) return data;
        const nm = `${a.name} (${game.i18n.localize(YZEGS.vehicle.crewPositionFlagsLocalized[o.position])})`;
        data[o.id] = nm;
        return data;
      }, {});

      const opts = await YZEGSDialog.chooseActor(actors);
      if (opts.cancelled) return;

      const actorId = opts.actor;
      const actor = game.actors.get(actorId); // this.actor.getCrew().get(actorId);
      // if (!actor) {
      //   ui.notifications.warn('Actor does not exist.');
      //   return;
      // }
      return item.rollAttack({}, actor);
    }

    // Global action for item click.
    // return item.roll();
    return item.roll({ askForOptions: event.shiftKey }, this.actor);
  }

  /* ------------------------------------------- */

  _onItemCreate(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const type = elem.dataset.type;
    const itemData = {
      name: game.i18n.localize(`YZEGS.ActorSheet.NewItem.${type}`),
      type,
    };
    return (
      this.actor
        .createEmbeddedDocuments('Item', [itemData])
        // Displays the sheet of the newly created item.
        .then(itmData => {
          const itemId = itmData[0].id;
          const item = this.actor.items.get(itemId);
          item.sheet.render(true);
        })
    );
  }

  _onItemEdit(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.sheet.render(true);
  }

  _onItemDelete(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    return this.actor.deleteEmbeddedDocuments('Item', [itemId]);
  }

  _onItemChat(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.displayCard();
  }

  _onItemEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const equipped = item.system.equipped;
    const updateData = { 'system.equipped': !equipped };
    if (!equipped && item.system.backpack) updateData['system.backpack'] = false;
    return item.update(updateData);
  }

  _onItemStore(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const stored = item.system.backpack;
    const updateData = { 'system.backpack': !stored };
    if (!stored && item.system.equipped) updateData['system.equipped'] = false;
    return item.update(updateData);
  }

  /* ------------------------------------------- */

  _onWeaponAmmoChange(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const value = +elem.value;
    return item.update({ 'system.mag.value': value });
  }

  /* ------------------------------------------- */

  /** Left-clic: +1, Right-clic: -1 */
  _onValueChange(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const min = +elem.dataset.min || 0;
    const max = +elem.dataset.max || 10;
    const field = elem.dataset.field;
    const currentCount = foundry.utils.getProperty(this.actor, `system.${field}`) || 0;
    let newCount = currentCount;

    if (event.type === 'click') newCount++;
    else newCount--; // contextmenu
    newCount = Math.clamp(newCount, min, max);

    return this.actor.update({ [`system.${field}`]: newCount });
  }
}
