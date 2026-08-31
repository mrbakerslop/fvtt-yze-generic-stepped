import { enrichTextFields } from '../utils/utils.js';
import { getCharacterFieldLabels } from '../system/character-field-labels.js';
import { activateRatingMenus } from '../components/rating-menu.js';
import { activateCheckboxControls } from '../components/checkbox-control.js';
import { getAdvancementSourceItems } from '../system/experience.js';
import { COMBAT_TYPES } from '../system/combat-modifiers.js';
import { linesFromText, parseRankOptions } from '../system/archetype-rules.js';
import { usesItemQuantity } from '../system/item-quantity.js';
import {
  weaponUsesAmmoBelt,
  weaponUsesInternalMagazine,
  weaponUsesMagazine,
} from '../system/ammunition-compatibility.js';
import { getEffectiveWeaponProfile } from '../system/weapon-profile.js';

const ITEM_SHEET_HEIGHTS = {
  ammunition: 480,
  archetype: 760,
  armor: 390,
  gear: 370,
  grenade: 500,
  injury: 360,
  disease: 610,
  skill: 320,
  weapon: 730,
};

const ITEM_SHEET_WIDTHS = {
  archetype: 600,
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
      tabs: [
        { id: 'features' },
        { id: 'modifiers' },
        { id: 'background' },
        { id: 'equipment' },
        { id: 'description' },
      ],
      initial: 'features',
    },
  };

  /** @override */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    const hasCustomWidth = Object.hasOwn(options.position ?? {}, 'width');
    const hasCustomHeight = Object.hasOwn(options.position ?? {}, 'height');
    const defaultWidth = ITEM_SHEET_WIDTHS[options.document?.type];
    const defaultHeight = ITEM_SHEET_HEIGHTS[options.document?.type];
    if (defaultWidth && !hasCustomWidth) {
      applicationOptions.position.width = defaultWidth;
    }
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
      showQuantity: this.item.isPhysical && usesItemQuantity(this.item.type, this.item.system),
      internalMagazine: weaponUsesInternalMagazine(this.item),
      canClearJam: this.item.type === 'weapon'
        && this.item.system.jammed
        && ['character', 'npc'].includes(this.item.actor?.type),
      explosiveTypeChoices: {
        grenade: game.i18n.localize('YZEGS.ExplosiveTypes.grenade'),
        antiPersonnelMine: game.i18n.localize('YZEGS.ExplosiveTypes.antiPersonnelMine'),
        antiVehicleMine: game.i18n.localize('YZEGS.ExplosiveTypes.antiVehicleMine'),
        directionalMine: game.i18n.localize('YZEGS.ExplosiveTypes.directionalMine'),
        multipurposeMine: game.i18n.localize('YZEGS.ExplosiveTypes.multipurposeMine'),
      },
      guidanceModeChoices: {
        none: game.i18n.localize('YZEGS.Guidance.Modes.None'),
        directed: game.i18n.localize('YZEGS.Guidance.Modes.Directed'),
        surfaceSeeking: game.i18n.localize('YZEGS.Guidance.Modes.SurfaceSeeking'),
        airSeeking: game.i18n.localize('YZEGS.Guidance.Modes.AirSeeking'),
        underwaterSeeking: game.i18n.localize('YZEGS.Guidance.Modes.UnderwaterSeeking'),
      },
      guidanceTargetChoices: {
        any: game.i18n.localize('YZEGS.Guidance.Targets.Any'),
        aircraft: game.i18n.localize('YZEGS.Guidance.Targets.Aircraft'),
        watercraft: game.i18n.localize('YZEGS.Guidance.Targets.Watercraft'),
        largeVessel: game.i18n.localize('YZEGS.Guidance.Targets.LargeVessel'),
        groundOrWater: game.i18n.localize('YZEGS.Guidance.Targets.GroundOrWater'),
      },
      firingArcChoices: {
        all: game.i18n.localize('YZEGS.Guidance.Arcs.All'),
        front: game.i18n.localize('YZEGS.Guidance.Arcs.Front'),
        rear: game.i18n.localize('YZEGS.Guidance.Arcs.Rear'),
        port: game.i18n.localize('YZEGS.Guidance.Arcs.Port'),
        starboard: game.i18n.localize('YZEGS.Guidance.Arcs.Starboard'),
      },
      sparePartChoices: {
        none: game.i18n.localize('YZEGS.SpareParts.None'),
        universal: game.i18n.localize('YZEGS.SpareParts.Universal'),
        hull: game.i18n.localize('YZEGS.SpareParts.Hull'),
        engine: game.i18n.localize('YZEGS.SpareParts.Engine'),
        propulsion: game.i18n.localize('YZEGS.SpareParts.Propulsion'),
        rigging: game.i18n.localize('YZEGS.SpareParts.Rigging'),
        radio: game.i18n.localize('YZEGS.SpareParts.Radio'),
        antenna: game.i18n.localize('YZEGS.SpareParts.Antenna'),
      },
      waterProtectionChoices: {
        none: game.i18n.localize('YZEGS.WaterProtection.None'),
        wetsuit: game.i18n.localize('YZEGS.WaterProtection.Wetsuit'),
        drySuit: game.i18n.localize('YZEGS.WaterProtection.DrySuit'),
      },
      chemicalProtectionChoices: {
        none: game.i18n.localize('YZEGS.ChemicalProtection.None'),
        mask: game.i18n.localize('YZEGS.ChemicalProtection.Mask'),
        clothing: game.i18n.localize('YZEGS.ChemicalProtection.Clothing'),
        hazmat: game.i18n.localize('YZEGS.ChemicalProtection.Hazmat'),
      },
      medicalTreatmentChoices: {
        none: game.i18n.localize('YZEGS.MedicalTreatment.None'),
        atropine: game.i18n.localize('YZEGS.MedicalTreatment.Atropine'),
        antibiotics: game.i18n.localize('YZEGS.MedicalTreatment.Antibiotics'),
        decontamination: game.i18n.localize('YZEGS.MedicalTreatment.Decontamination'),
      },
      diseaseCategoryChoices: {
        disease: game.i18n.localize('YZEGS.Disease.Category.Disease'),
        woundInfection: game.i18n.localize('YZEGS.Disease.Category.WoundInfection'),
        blisterAgent: game.i18n.localize('YZEGS.Disease.Category.BlisterAgent'),
        nerveAgent: game.i18n.localize('YZEGS.Disease.Category.NerveAgent'),
        radiation: game.i18n.localize('YZEGS.Disease.Category.Radiation'),
        custom: game.i18n.localize('YZEGS.Disease.Category.Custom'),
      },
      hazardTimeUnitChoices: {
        round: game.i18n.localize('YZEGS.Hazards.Time.Round'),
        stretch: game.i18n.localize('YZEGS.Hazards.Time.Stretch'),
        shift: game.i18n.localize('YZEGS.Hazards.Time.Shift'),
        day: game.i18n.localize('YZEGS.Hazards.Time.Day'),
      },
    });

    if (this.item.type === 'specialty' && this.tabGroups.primary === 'features') {
      this.tabGroups.primary = 'modifiers';
      sheetData.tabs = this._prepareTabs('primary');
    }

    if (this.item.type === 'archetype') await this._prepareArchetypeContext(sheetData);

    await enrichTextFields(sheetData, ['system.description']);

    if (['weapon', 'ammunition'].includes(this.item.type)) {
      // Potential Ammo Targets
      sheetData.availableAmmoTypes = this._getAvailableAmmoTypes();
      sheetData.availableAmmoTypeOptions = Object.fromEntries(
        sheetData.availableAmmoTypes.map(ammoType => [ammoType, ammoType]),
      );
    }
    if (this.item.type === 'weapon') {
      const loadedAmmunition = this.item.actor?.items.get(this.item.system.mag.target);
      // Recalculate from the current target instead of trusting derived Item data
      // which may predate a sibling Ammunition document update.
      sheetData.system.effectiveAttack = getEffectiveWeaponProfile(this.item, loadedAmmunition);
      if (loadedAmmunition?.type === 'ammunition') {
        const ammunitionCount = weaponUsesInternalMagazine(this.item)
          ? ''
          : ` [${loadedAmmunition.system.ammo.value}/${loadedAmmunition.system.ammo.max}]`;
        sheetData.loadedAmmunitionLabel = `${loadedAmmunition.name}${ammunitionCount}`;
      }
    }

    return sheetData;
  }

  async _prepareArchetypeContext(sheetData) {
    const resolveReference = async uuid => {
      try {
        const source = await fromUuid(uuid);
        return { uuid, name: source?.name ?? uuid, missing: !source };
      }
      catch (_error) {
        return { uuid, name: uuid, missing: true };
      }
    };
    sheetData.archetype = {
      branches: this.item.system.branches.join('\n'),
      rankOptions: this.item.system.rank.options.map(option => (
        `${option.min ?? ''}-${option.max ?? ''} | ${option.label ?? ''}`
      )).join('\n'),
      prompts: Object.fromEntries(Object.entries(this.item.system.prompts).map(([key, values]) => [
        key,
        values.join('\n'),
      ])),
      keySkills: await Promise.all(this.item.system.keySkills.map(resolveReference)),
      specialties: await Promise.all(this.item.system.specialties.map(resolveReference)),
      equipment: await Promise.all(this.item.system.equipment.map(async (entry, index) => ({
        ...entry,
        index,
        source: await resolveReference(entry.uuid),
      }))),
    };
    sheetData.rankModeChoices = {
      none: 'YZEGS.Archetype.RankModes.none',
      choose: 'YZEGS.Archetype.RankModes.choose',
      roll: 'YZEGS.Archetype.RankModes.roll',
    };
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

  _activateArchetypeListeners() {
    const updateArrayField = event => {
      const field = event.currentTarget.dataset.archetypeArray;
      if (!field) return;
      return this.item.update({ [`system.${field}`]: linesFromText(event.currentTarget.value) });
    };
    this.element.querySelectorAll('[data-archetype-array]').forEach(input => {
      input.addEventListener('change', updateArrayField);
    });
    this.element.querySelector('[data-archetype-ranks]')?.addEventListener('change', event => (
      this.item.update({ 'system.rank.options': parseRankOptions(event.currentTarget.value) })
    ));
    this.element.querySelectorAll('[data-archetype-remove]').forEach(button => {
      button.addEventListener('click', event => this._onArchetypeReferenceRemove(event));
    });
    this.element.querySelectorAll('.archetype-equipment-input').forEach(input => {
      input.addEventListener('change', event => this._onArchetypeEquipmentChange(event));
    });
    this.element.querySelectorAll('[data-archetype-drop]').forEach(zone => {
      zone.addEventListener('dragover', event => event.preventDefault());
      zone.addEventListener('drop', event => this._onArchetypeReferenceDrop(event));
    });
  }

  async _onArchetypeReferenceDrop(event) {
    event.preventDefault();
    const field = event.currentTarget.dataset.archetypeDrop;
    const dropData = TextEditor.getDragEventData(event);
    const item = await Item.implementation.fromDropData(dropData);
    if (!item) return;
    if (item.actor) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Archetype.Errors.EmbeddedSource'));
    }
    if (field === 'keySkills' && item.type !== 'skill') {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Archetype.Errors.DropSkill'));
    }
    if (field === 'specialties' && item.type !== 'specialty') {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Archetype.Errors.DropSpecialty'));
    }
    if (field === 'equipment' && !CONFIG.YZEGS.physicalItems.includes(item.type)) {
      return ui.notifications.warn(game.i18n.localize('YZEGS.Archetype.Errors.DropEquipment'));
    }
    if (field === 'equipment') {
      const equipment = foundry.utils.deepClone(this.item.system.equipment);
      if (equipment.some(entry => entry.uuid === item.uuid)) return null;
      equipment.push({
        uuid: item.uuid,
        name: item.name,
        group: '',
        quantityFormula: '1',
        required: true,
      });
      return this.item.update({ 'system.equipment': equipment });
    }
    const references = [...this.item.system[field]];
    if (!references.includes(item.uuid)) references.push(item.uuid);
    return this.item.update({ [`system.${field}`]: references });
  }

  _onArchetypeReferenceRemove(event) {
    event.preventDefault();
    const field = event.currentTarget.dataset.archetypeRemove;
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return null;
    const values = foundry.utils.deepClone(this.item.system[field]);
    values.splice(index, 1);
    return this.item.update({ [`system.${field}`]: values });
  }

  _onArchetypeEquipmentChange(event) {
    const index = Number(event.currentTarget.dataset.index);
    const property = event.currentTarget.dataset.property;
    if (!Number.isInteger(index) || !property) return null;
    const equipment = foundry.utils.deepClone(this.item.system.equipment);
    if (!equipment[index]) return null;
    equipment[index][property] = event.currentTarget.type === 'checkbox'
      ? event.currentTarget.checked
      : event.currentTarget.value;
    return this.item.update({ 'system.equipment': equipment });
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

  /* ------------------------------------------- */
  /*  Sheet Listeners                            */
  /* ------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    activateRatingMenus(this.element);
    activateCheckboxControls(this.element, (path, value) => this.item.update({ [path]: value }));

    if (this.item.type === 'archetype' && this.isEditable) this._activateArchetypeListeners();
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
      html.find('button.weapon-reload-action').click(event => {
        event.preventDefault();
        return this.item.reload();
      });
      html.find('button.weapon-clear-jam-action').click(event => {
        event.preventDefault();
        return this.item.clearJam();
      });
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
    const isBelt = weaponUsesAmmoBelt(this.item);
    const isMagazine = weaponUsesMagazine(this.item);
    const isInternal = weaponUsesInternalMagazine(this.item);
    let mag = 'Ammo';
    if (isBelt) mag = 'Belt';
    else if (isMagazine) mag = size > 40 ? 'Drum' : 'Mag';

    const itemData = {
      name: `${ammo}, ${size}-round ${mag}`,
      type: 'ammunition',
      'system.itemType': this.item.system.ammo,
      'system.qty': isInternal ? size : 1,
      'system.ammo': isInternal ? { value: 1, max: 1 } : { value: size, max: size },
      'system.props.magazine': isMagazine,
      'system.props.ammoBelt': isBelt,
      'system.props.ammoBox': false,
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
