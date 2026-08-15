import {
  CHARACTER_FIELD_LABELS_SETTING,
  CharacterFieldLabelsConfig,
  DEFAULT_CHARACTER_FIELD_LABELS,
  refreshCharacterSheets,
} from './character-field-labels.js';
import {
  SKILL_ITEMS_MIGRATION_SETTING,
  WORLD_SKILL_CLEANUP_SETTING,
} from './skill-migration.js';
import {
  ADVANCEMENT_ITEM_SOURCE_SETTING,
  DEFAULT_EXPERIENCE_CONFIG,
  EXPERIENCE_CONFIG_SETTING,
  ExperienceConfig,
  getAdvancementItemSourceChoices,
  refreshExperienceSheets,
  WORLD_ADVANCEMENT_ITEM_SOURCE,
} from './experience-config.js';
import { MACRO_FOLDER_CLEANUP_SETTING } from './macros.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const NOTES_TAB_SETTING = 'enableNotesTab';
export const RADIATION_ENABLED_SETTING = 'enableRadiation';
export const RADIATION_NAME_SETTING = 'radiationName';

/** Whether the world's Radiation rules are enabled. */
export function isRadiationEnabled() {
  return game.settings.get(SYSTEM_ID, RADIATION_ENABLED_SETTING);
}

/** Return the configured Radiation label or its localized default. */
export function getRadiationLabel({ roll = false } = {}) {
  const customName = String(game.settings.get(SYSTEM_ID, RADIATION_NAME_SETTING) ?? '').trim();
  if (customName) return customName;
  const localizationKey = roll ? 'YZEGS.ActorSheet.RadiationRoll' : 'YZEGS.ActorSheet.Radiation';
  return game.i18n.localize(localizationKey);
}

/** Refresh all open Actor sheets after a display setting changes. */
function refreshActorSheets() {
  for (const actor of game.actors) {
    for (const app of Object.values(actor.apps)) {
      if (!app.rendered) continue;
      if (app instanceof foundry.applications.api.ApplicationV2) app.render({ force: true });
      else app.render(false);
    }
  }
}

// config: true (visible)
// scope: world (gm), client (player)

/**
 * Registers system settings.
 */
export function registerSystemSettings() {
  game.settings.register(SYSTEM_ID, EXPERIENCE_CONFIG_SETTING, {
    config: false,
    scope: 'world',
    name: 'SETTINGS.experienceConfig.name',
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_EXPERIENCE_CONFIG),
    onChange: refreshExperienceSheets,
  });

  game.settings.registerMenu(SYSTEM_ID, EXPERIENCE_CONFIG_SETTING, {
    name: 'SETTINGS.experienceConfig.name',
    label: 'SETTINGS.experienceConfig.label',
    hint: 'SETTINGS.experienceConfig.hint',
    icon: 'fa-solid fa-arrow-trend-up',
    type: ExperienceConfig,
    restricted: true,
  });

  game.settings.register(SYSTEM_ID, ADVANCEMENT_ITEM_SOURCE_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.advancementItemSource.name',
    hint: 'SETTINGS.advancementItemSource.hint',
    type: String,
    choices: getAdvancementItemSourceChoices(),
    default: WORLD_ADVANCEMENT_ITEM_SOURCE,
    onChange: refreshExperienceSheets,
  });

  game.settings.register(SYSTEM_ID, SKILL_ITEMS_MIGRATION_SETTING, {
    config: false,
    scope: 'world',
    name: 'Skill Items Migration Complete',
    type: Boolean,
    default: false,
  });

  game.settings.register(SYSTEM_ID, WORLD_SKILL_CLEANUP_SETTING, {
    config: false,
    scope: 'world',
    name: 'World Skill Item Cleanup Complete',
    type: Boolean,
    default: false,
  });

  game.settings.register(SYSTEM_ID, MACRO_FOLDER_CLEANUP_SETTING, {
    config: false,
    scope: 'world',
    name: 'Macro Folder Cleanup Complete',
    type: Boolean,
    default: false,
  });

  game.settings.register(SYSTEM_ID, CHARACTER_FIELD_LABELS_SETTING, {
    config: false,
    scope: 'world',
    name: 'SETTINGS.characterFieldLabels.name',
    type: Object,
    default: { ...DEFAULT_CHARACTER_FIELD_LABELS },
    onChange: refreshCharacterSheets,
  });

  game.settings.registerMenu(SYSTEM_ID, CHARACTER_FIELD_LABELS_SETTING, {
    name: 'SETTINGS.characterFieldLabels.name',
    label: 'SETTINGS.characterFieldLabels.label',
    hint: 'SETTINGS.characterFieldLabels.hint',
    icon: 'fa-solid fa-tags',
    type: CharacterFieldLabelsConfig,
    restricted: true,
  });

  // Tracks the system version.
  game.settings.register('fvtt-yze-generic-stepped', 'systemMigrationVersion', {
    config: false,
    scope: 'world',
    name: 'System Migration Version',
    type: String,
    default: '',
  });
  game.settings.register('fvtt-yze-generic-stepped', 'messages', {
    name: 'Displayed Messages',
    hint: 'Used to track which messages have been displayed',
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register('fvtt-yze-generic-stepped', 'hideCapacitiesButtons', {
    config: true,
    scope: 'world',
    name: 'SETTINGS.hideCapacitiesButtons.name',
    hint: 'SETTINGS.hideCapacitiesButtons.label',
    type: Boolean,
    default: false,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'hideWeaponProps', {
    config: true,
    scope: 'world',
    name: 'SETTINGS.hideWeaponProps.name',
    hint: 'SETTINGS.hideWeaponProps.label',
    type: Boolean,
    default: false,
  });

  game.settings.register(SYSTEM_ID, NOTES_TAB_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.enableNotesTab.name',
    hint: 'SETTINGS.enableNotesTab.hint',
    type: Boolean,
    default: true,
    onChange: refreshActorSheets,
  });

  game.settings.register(SYSTEM_ID, RADIATION_ENABLED_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.enableRadiation.name',
    hint: 'SETTINGS.enableRadiation.hint',
    type: Boolean,
    default: true,
    onChange: refreshActorSheets,
  });

  game.settings.register(SYSTEM_ID, RADIATION_NAME_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.radiationName.name',
    hint: 'SETTINGS.radiationName.hint',
    type: String,
    default: '',
    onChange: refreshActorSheets,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'trackPcAmmo', {
    config: true,
    scope: 'world',
    name: 'SETTINGS.trackPcAmmo.name',
    hint: 'SETTINGS.trackPcAmmo.label',
    type: Boolean,
    default: true,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'trackNpcAmmo', {
    config: true,
    scope: 'world',
    name: 'SETTINGS.trackNpcAmmo.name',
    hint: 'SETTINGS.trackNpcAmmo.label',
    type: Boolean,
    default: false,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'trackVehicleAmmo', {
    config: true,
    scope: 'world',
    name: 'SETTINGS.trackVehicleAmmo.name',
    hint: 'SETTINGS.trackVehicleAmmo.label',
    type: Boolean,
    default: true,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'showTaskCheckOptions', {
    config: true,
    scope: 'client',
    name: 'SETTINGS.showTaskCheckOptions.name',
    hint: 'SETTINGS.showTaskCheckOptions.label',
    type: Boolean,
    default: true,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'closeRollTooltipDelay', {
    config: true,
    scope: 'client',
    name: 'SETTINGS.closeRollTooltipDelay.name',
    hint: 'SETTINGS.closeRollTooltipDelay.label',
    type: Number,
    default: 60,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'defaultCharTokenSize', {
    config: true,
    scope: 'world',
    name: 'SETTINGS.defaultCharTokenSize.name',
    hint: 'SETTINGS.defaultCharTokenSize.label',
    type: Number,
    default: 1,
  });

  game.settings.register('fvtt-yze-generic-stepped', 'travelRollAllowPush', {
    config: false,
    scope: 'world',
    name: 'FLPS.SETTINGS.ALLOW_PUSH',
    hint: 'FLPS.SETTINGS.ALLOW_PUSH_HINT',
    type: Boolean,
    default: false,
  });
}
