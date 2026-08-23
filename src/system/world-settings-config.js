import { activateCheckboxControls } from '../components/checkbox-control.js';
import { activateRatingMenus } from '../components/rating-menu.js';
import {
  ADVANCEMENT_ITEM_SOURCE_SETTING,
  getAdvancementItemSourceChoices,
  WORLD_ADVANCEMENT_ITEM_SOURCE,
} from './experience-config.js';
import {
  CRITICAL_INJURIES_ENABLED_SETTING,
  CRITICAL_INJURY_TABLE_SETTINGS,
} from './critical-injuries.js';
import {
  INTERNAL_RELOAD_MODES,
  INTERNAL_RELOAD_MODE_SETTING,
} from './reloading.js';
import {
  PUSH_COST_MODES,
  PUSH_COST_MODE_SETTING,
} from './push-costs.js';
import {
  SCENE_GRID_PRESET_IDS,
  SCENE_GRID_PRESET_SETTING,
} from './scene-grid.js';
import { TACTICAL_TERRAIN_SETTING } from './tactical-terrain.js';
import {
  SEPARATE_COVER_ARMOR_SETTING,
  STACK_BODY_ARMOR_SETTING,
} from './armor-rules.js';
import { CLOSE_COMBAT_POSITION_SETTING } from './close-combat-positioning.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

const BOOLEAN_SETTINGS = [
  'enableNotesTab',
  'enableUnitMorale',
  'enableRadiation',
  'hideCapacitiesButtons',
  'hideWeaponProps',
  TACTICAL_TERRAIN_SETTING,
  CLOSE_COMBAT_POSITION_SETTING,
  STACK_BODY_ARMOR_SETTING,
  SEPARATE_COVER_ARMOR_SETTING,
  CRITICAL_INJURIES_ENABLED_SETTING,
  'trackPcAmmo',
  'trackNpcAmmo',
  'trackVehicleAmmo',
];

/** Consolidated GM-facing configuration for the system's simple world settings. */
export class WorldSettingsConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'yzegs-world-settings',
    classes: ['yzegs', 'world-settings-config'],
    tag: 'form',
    position: { width: 780, height: 760 },
    window: {
      icon: 'fa-solid fa-sliders',
      title: 'SETTINGS.worldSettings.name',
      contentClasses: ['standard-form'],
    },
    form: {
      closeOnSubmit: true,
      handler: WorldSettingsConfig.#onSubmit,
    },
  };

  static PARTS = {
    body: {
      template: 'systems/fvtt-yze-generic-stepped/templates/system/world-settings.hbs',
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const get = key => game.settings.get(SYSTEM_ID, key);
    const advancementSource = String(get(ADVANCEMENT_ITEM_SOURCE_SETTING) ?? WORLD_ADVANCEMENT_ITEM_SOURCE);
    const advancementSources = getAdvancementItemSourceChoices();
    if (!Object.hasOwn(advancementSources, advancementSource)) {
      advancementSources[advancementSource] = game.i18n.format(
        'SETTINGS.advancementItemSource.unavailable',
        { source: advancementSource },
      );
    }

    context.values = {
      ...Object.fromEntries(BOOLEAN_SETTINGS.map(key => [key, Boolean(get(key))])),
      radiationName: get('radiationName'),
      killingBlowSpecialty: get('killingBlowSpecialty'),
      pushCostMode: get(PUSH_COST_MODE_SETTING),
      internalMagazineReloadMode: get(INTERNAL_RELOAD_MODE_SETTING),
      defaultSceneGridPreset: get(SCENE_GRID_PRESET_SETTING),
      advancementItemSource: advancementSource,
    };
    context.criticalTables = Object.entries(CRITICAL_INJURY_TABLE_SETTINGS).map(([hitLocation, key]) => ({
      location: hitLocation,
      key,
      label: game.i18n.localize(`SETTINGS.criticalInjuryTable.${hitLocation}.name`),
      value: get(key),
    }));
    context.pushCostModes = {
      [PUSH_COST_MODES.MANUAL]: 'SETTINGS.pushCostMode.choices.manual',
      [PUSH_COST_MODES.BUTTON]: 'SETTINGS.pushCostMode.choices.button',
      [PUSH_COST_MODES.AUTOMATIC]: 'SETTINGS.pushCostMode.choices.automatic',
    };
    context.reloadModes = {
      [INTERNAL_RELOAD_MODES.FULL]: 'SETTINGS.internalMagazineReloadMode.choices.full',
      [INTERNAL_RELOAD_MODES.PER_ROUND]: 'SETTINGS.internalMagazineReloadMode.choices.perRound',
    };
    context.sceneGridPresets = {
      [SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS]: 'SETTINGS.defaultSceneGridPreset.choices.closeQuarters',
      [SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS_SQUARE]: 'SETTINGS.defaultSceneGridPreset.choices.closeQuartersSquare',
      [SCENE_GRID_PRESET_IDS.BATTLE]: 'SETTINGS.defaultSceneGridPreset.choices.battle',
      [SCENE_GRID_PRESET_IDS.BATTLE_SQUARE]: 'SETTINGS.defaultSceneGridPreset.choices.battleSquare',
      [SCENE_GRID_PRESET_IDS.CITY]: 'SETTINGS.defaultSceneGridPreset.choices.city',
      [SCENE_GRID_PRESET_IDS.CITY_SQUARE]: 'SETTINGS.defaultSceneGridPreset.choices.citySquare',
      [SCENE_GRID_PRESET_IDS.TRAVEL]: 'SETTINGS.defaultSceneGridPreset.choices.travel',
      [SCENE_GRID_PRESET_IDS.TRAVEL_SQUARE]: 'SETTINGS.defaultSceneGridPreset.choices.travelSquare',
      [SCENE_GRID_PRESET_IDS.SYSTEM]: 'SETTINGS.defaultSceneGridPreset.choices.system',
    };
    context.advancementSources = advancementSources;
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    activateRatingMenus(this.element);
    activateCheckboxControls(this.element, (path, value) => {
      const hiddenInput = [...this.element.querySelectorAll('input[type="hidden"]')]
        .find(input => input.name === path);
      if (hiddenInput) hiddenInput.value = String(value);
    });
  }

  static async #onSubmit(_event, _form, formData) {
    const submitted = formData.object;
    const asBoolean = value => value === true || value === 'true' || value === 'on';
    const updates = [
      ...BOOLEAN_SETTINGS.map(key => [key, asBoolean(submitted[key])]),
      ['radiationName', String(submitted.radiationName ?? '').trim()],
      ['killingBlowSpecialty', String(submitted.killingBlowSpecialty ?? '').trim()],
      [PUSH_COST_MODE_SETTING, submitted.pushCostMode],
      [INTERNAL_RELOAD_MODE_SETTING, submitted.internalMagazineReloadMode],
      [SCENE_GRID_PRESET_SETTING, submitted.defaultSceneGridPreset],
      [ADVANCEMENT_ITEM_SOURCE_SETTING, submitted.advancementItemSource],
      ...Object.values(CRITICAL_INJURY_TABLE_SETTINGS)
        .map(key => [key, String(submitted[key] ?? '').trim()]),
    ];

    for (const [key, value] of updates) {
      if (game.settings.get(SYSTEM_ID, key) === value) continue;
      await game.settings.set(SYSTEM_ID, key, value);
    }
    ui.notifications.info(game.i18n.localize('SETTINGS.worldSettings.saved'));
  }
}
