import {
  CHARACTER_FIELD_LABELS_SETTING,
  CharacterFieldLabelsConfig,
  DEFAULT_CHARACTER_FIELD_LABELS,
  refreshCharacterSheets,
} from './character-field-labels.js';
import { SKILL_ITEMS_MIGRATION_SETTING } from './skill-migration.js';
import {
  DEFAULT_EXPERIENCE_CONFIG,
  EXPERIENCE_CONFIG_SETTING,
  ExperienceConfig,
  refreshExperienceSheets,
} from './experience-config.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

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

  game.settings.register(SYSTEM_ID, SKILL_ITEMS_MIGRATION_SETTING, {
    config: false,
    scope: 'world',
    name: 'Skill Items Migration Complete',
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
