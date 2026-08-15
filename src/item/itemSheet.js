import { enrichTextFields } from '@utils/utils';
import { getCharacterFieldLabels } from '../system/character-field-labels.js';
import { activateRatingMenus } from '../components/rating-menu.js';
import { activateCheckboxControls } from '../components/checkbox-control.js';
import { getAdvancementSourceItems } from '../system/experience.js';
import { COMBAT_TYPES } from '../system/combat-modifiers.js';

const ITEM_SHEET_HEIGHTS = {
  ammunition: 480,
  armor: 390,
  gear: 370,
  grenade: 430,
  injury: 360,
  skill: 320,
  weapon: 625,
};

/**
 * Year Zero Engine - Generic Stepped Dice Item Sheet.
 * @extends {foundry.applications.sheets.ItemSheetV2} Extends the V2 ItemSheet
 */
export default class ItemSheetYZEGS extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
) {
  /* ------------------------------------------- */
  /*  Sheet Properties                           */
  /* ------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['yzegs', 'item'],
    position: { width: 400, height: 550 },
    window: { resizable: true, contentClasses: ['flexcol'] },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    sheet: { template: '' },
  };

  static TABS = {
    primary: {
      tabs: [{ id: 'features' }, { id: 'modifiers' }, { id: 'description' }],
      initial: 'features',
    },
  };

  /** @override */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    const hasCustomHeight = Object.hasOwn(options.position ?? {}, 'height');
    const defaultHeight = ITEM_SHEET_HEIGHTS[options.document?.type];
    if (defaultHeight && !hasCustomHeight) {
      applicationOptions.position.height = defaultHeight;
    }
    return applicationOptions;
  }

  /** @override */
  get template() {
    return `systems/fvtt-yze-generic-stepped/templates/item/${this.item.type}-sheet.hbs`;
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
    const descriptionValue = this.item.system.description ?? '';
    const characterFieldLabels = getCharacterFieldLabels();
    const attributeChoices = Object.fromEntries(Object.keys(CONFIG.YZEGS.attributes).map(attribute => [
      attribute,
      characterFieldLabels[attribute],
    ]));
    const actorSkills = ['character', 'npc'].includes(this.item.actor?.type)
      ? this.item.actor.itemTypes.skill
      : null;
    const availableSkills = actorSkills ?? await getAdvancementSourceItems('skill');
    const attributeOptions = Object.fromEntries(Object.keys(CONFIG.YZEGS.attributes).map(attribute => [
      `attribute.${attribute}`,
      characterFieldLabels[attribute],
    ]));
    const skillModifierOptions = Object.fromEntries(
      availableSkills.map(skill => [`skill.${skill.id}`, skill.name]),
    );
    const localizeOptions = optionLabels => Object.fromEntries(
      Object.entries(optionLabels).map(([value, label]) => [value, game.i18n.localize(label)]),
    );
    const rollModifierGroups = [
      { label: game.i18n.localize('YZEGS.Attributes'), options: attributeOptions },
      { label: game.i18n.localize('YZEGS.Skills'), options: skillModifierOptions },
      { label: game.i18n.localize('YZEGS.Constants'), options: localizeOptions(CONFIG.YZEGS.constantsOptions) },
      { label: game.i18n.localize('YZEGS.Actions'), options: localizeOptions(CONFIG.YZEGS.actionOptions) },
      { label: game.i18n.localize('YZEGS.TravelTasks'), options: localizeOptions(CONFIG.YZEGS.travelTaskOptions) },
    ];
    Object.assign(sheetData, {
      owner: this.item.isOwner,
      editable: this.isEditable,
      item: foundry.utils.deepClone(this.item),
      system: foundry.utils.deepClone(this.item.system),
      descriptionValue,
      documentUuid: this.item.uuid,
      config: CONFIG.YZEGS,
      attributeChoices,
      combatTypeChoices: Object.fromEntries(Object.entries(COMBAT_TYPES).map(([value, label]) => [
        value,
        game.i18n.localize(label),
      ])),
      attributeOptions,
      skillOptions: Object.fromEntries(availableSkills.map(skill => [skill.id, skill.name])),
      skillModifierOptions,
      rollModifierGroups,
      rollModifierLabels: Object.assign({}, ...rollModifierGroups.map(group => group.options)),
      hideWeaponProps: !game.user.isGM && game.settings.get('fvtt-yze-generic-stepped', 'hideWeaponProps'),
      // QoL getters
      inActor: !!this.item.actor,
      inVehicle: this.item.actor?.type === 'vehicle',
    });

    if (this.item.type === 'specialty' && this.tabGroups.primary === 'features') {
      this.tabGroups.primary = 'modifiers';
      sheetData.tabs = this._prepareTabs('primary');
    }

    await enrichTextFields(sheetData, ['system.description']);

    if (['weapon', 'ammunition'].includes(this.item.type)) {
      // Potential Ammo Targets
      sheetData.availableAmmoTypes = this._getAvailableAmmoTypes();
      sheetData.availableAmmoTypeOptions = Object.fromEntries(
        sheetData.availableAmmoTypes.map(ammoType => [ammoType, ammoType]),
      );
    }
    if (this.item.type === 'weapon') {
      sheetData.ammunitionTargets = this._getItemAmmunitionTargets();
    }

    return sheetData;
  }

  /* ------------------------------------------- */

  _getAvailableAmmoTypes() {
    let ammoTypes = this._extractAmmoTypes(game.items.contents);
    const actor = this.item.actor;
    if (actor) {
      ammoTypes = this._extractAmmoTypes(actor.items.contents, ammoTypes);
    }
    return [...ammoTypes].sort();
  }

  /* ------------------------------------------- */

  /**
   * Extracts the ammo types stored in the items provided.
   * @param   {Item[]} items      List of items
   * @param   {Set}   [ammoTypes] A collection of ammo types
   * @returns {Set<string>} Returns a Set object because it removes the duplicates.
   * @private
   */
  _extractAmmoTypes(items = [], ammoTypes = new Set()) {
    if (!items.length) return ammoTypes;
    return items.reduce((ammo, i) => {
      if (i.type === 'ammunition') {
        ammo.add(i.system.itemType);
      }
      else if (i.type === 'weapon') {
        const t = i.system.ammo;
        if (t) ammo.add(t);
      }
      return ammo;
    }, ammoTypes);
  }

  /* ------------------------------------------- */

  /**
   * Gets the valid item consumption targets which exist on the actor.
   * @return {{string: string}} An object of potential consumption targets
   * @private
   */
  _getItemAmmunitionTargets() {
    // TODO clean this code
    const itemData = this.item.system;
    // const ammoType = itemData.ammo;
    // if (!ammoType) return {};

    const actor = this.item.actor;
    if (!actor) return {};

    return actor.itemTypes.ammunition.reduce(
      (ammo, i) => {
        // if (i.system.itemType === ammoType) {
        ammo[i.id] = i.detailedName;
        // }
        return ammo;
      },
      { [this.item.id]: `${this.item.name} (${itemData.qty})` },
    );
  }

  /* ------------------------------------------- */
  /*  Sheet Listeners                            */
  /* ------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    activateRatingMenus(this.element);
    activateCheckboxControls(this.element, (path, value) => this.item.update({ [path]: value }));
    const activeTab = this.element.querySelector(
      `.tabs [data-group="primary"][data-tab="${this.tabGroups.primary}"]`,
    );
    if (activeTab) this.changeTab(this.tabGroups.primary, 'primary', { force: true, updatePosition: false });

    // Editable-only Listeners
    if (!this.isEditable) return;

    // Input Focus & Update
    const inputs = html.find('input');
    inputs.focus(ev => ev.currentTarget.select());
    inputs.addBack().find('[data-dtype="Number"]').change(this._onChangeInputDelta.bind(this));

    // Roll Modifiers
    html.find('.add-modifier').click(this._onAddModifier.bind(this));
    html.find('.delete-modifier').click(this._onDeleteModifier.bind(this));

    // Ammo Generation
    if (this.item.actor) {
      html.find('button.create-ammo').click(this._onCreateAmmo.bind(this));
    }
  }

  /* ------------------------------------------- */

  /**
   * Changes the value based on an input delta.
   * @param {Event} event
   */
  _onChangeInputDelta(event) {
    event.preventDefault();
    const input = event.target;
    const value = input.value;
    if (value[0] === '+' || value[0] === '-') {
      const delta = parseFloat(value);
      input.value = foundry.utils.getProperty(this.item, input.name) + delta;
    }
    else if (value[0] === '=') {
      input.value = value.slice(1);
    }
  }

  /* ------------------------------------------- */

  _onAddModifier(event) {
    event.preventDefault();
    const rollModifiers = foundry.utils.deepClone(this.item.system.rollModifiers ?? {});
    const modifierId = Math.max(-1, ...Object.getOwnPropertyNames(rollModifiers)) + 1;
    return this.item.update({ [`system.rollModifiers.${modifierId}`]: { name: '', value: '+1' } });
  }

  _onDeleteModifier(event) {
    event.preventDefault();
    const modifierId = event.currentTarget.dataset.modifierId;
    if (this.item.system.rollModifiers[modifierId]) {
      return this.item.update({
        [`system.rollModifiers.${modifierId}`]: new foundry.data.operators.ForcedDeletion(),
      });
    }
  }

  /* ------------------------------------------- */

  async _onCreateAmmo(event) {
    event.preventDefault();
    if (!this.item.hasAmmo) return;
    if (!this.item.actor) return;

    const button = event.currentTarget;
    button.disabled = true;

    let ammo = this.item.system.ammo;
    if (ammo.match(/\d{2}$/)) ammo += 'mm';

    const size = this.item.system.mag.max;
    // eslint-disable-next-line no-nested-ternary
    const mag = size > 40 ? (size > 55 ? (size > 150 ? 'Box' : 'Belt') : 'Drum') : 'Mag';

    const itemData = {
      name: `${ammo}, ${size}-round ${mag}`,
      type: 'ammunition',
      'system.ammo': { value: size, max: size },
    };

    const [ammunition] = await this.item.actor.createEmbeddedDocuments('Item', [itemData]);
    const msg = game.i18n.format('YZEGS.ItemSheet.CreateAmmoNotif', {
      ammo: ammunition.name,
      weapon: this.item.name,
    });
    ui.notifications.info(msg);
    await this.item.update({ 'system.mag.target': ammunition.id });

    button.disabled = false;
    return ammunition;
  }
}
