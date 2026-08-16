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
  createAdvancementItemSourceInput,
  refreshExperienceSheets,
  WORLD_ADVANCEMENT_ITEM_SOURCE,
} from './experience-config.js';
import { MACRO_FOLDER_CLEANUP_SETTING } from './macros.js';
import {
  COMBAT_MODIFIERS_SETTING,
  CombatModifierConfig,
} from './combat-modifiers.js';
import {
  PUSH_COST_MODES,
  PUSH_COST_MODE_SETTING,
} from './push-costs.js';
import {
  INTERNAL_RELOAD_MODES,
  INTERNAL_RELOAD_MODE_SETTING,
} from './reloading.js';
import {
  SCENE_GRID_PRESET_IDS,
  SCENE_GRID_PRESET_SETTING,
} from './scene-grid.js';
import {
  DEFAULT_TOKEN_SIZE_DEFAULTS,
  LEGACY_CHARACTER_TOKEN_SIZE_SETTING,
  TOKEN_SIZE_DEFAULTS_SETTING,
} from './token-size-defaults.js';
import { TokenSizeDefaultsConfig } from './token-size-defaults-config.js';
import { ACTION_SKILLS_SETTING } from './action-skills.js';
import { ActionSkillsConfig } from './action-skills-config.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const NOTES_TAB_SETTING = 'enableNotesTab';
export const UNIT_MORALE_ENABLED_SETTING = 'enableUnitMorale';
export const RADIATION_ENABLED_SETTING = 'enableRadiation';
export const RADIATION_NAME_SETTING = 'radiationName';

/** Whether the world's Unit Morale rating is enabled. */
export function isUnitMoraleEnabled() {
  return game.settings.get(SYSTEM_ID, UNIT_MORALE_ENABLED_SETTING);
}

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
  game.settings.register(SYSTEM_ID, ACTION_SKILLS_SETTING, {
    config: false,
    scope: 'world',
    name: 'SETTINGS.actionSkills.name',
    type: Object,
    default: {},
  });

  game.settings.registerMenu(SYSTEM_ID, ACTION_SKILLS_SETTING, {
    name: 'SETTINGS.actionSkills.name',
    label: 'SETTINGS.actionSkills.label',
    hint: 'SETTINGS.actionSkills.hint',
    icon: 'fa-solid fa-person-running',
    type: ActionSkillsConfig,
    restricted: true,
  });

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
    type: new foundry.data.fields.StringField({ required: true, nullable: false }),
    input: createAdvancementItemSourceInput,
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

  game.settings.register(SYSTEM_ID, COMBAT_MODIFIERS_SETTING, {
    config: false,
    scope: 'world',
    name: 'SETTINGS.combatModifiers.name',
    type: Object,
    default: {},
  });

  game.settings.registerMenu(SYSTEM_ID, COMBAT_MODIFIERS_SETTING, {
    name: 'SETTINGS.combatModifiers.name',
    label: 'SETTINGS.combatModifiers.label',
    hint: 'SETTINGS.combatModifiers.hint',
    icon: 'fa-solid fa-crosshairs',
    type: CombatModifierConfig,
    restricted: true,
  });

  game.settings.register(SYSTEM_ID, TOKEN_SIZE_DEFAULTS_SETTING, {
    config: false,
    scope: 'world',
    name: 'SETTINGS.tokenSizeDefaults.name',
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_TOKEN_SIZE_DEFAULTS),
  });

  game.settings.registerMenu(SYSTEM_ID, TOKEN_SIZE_DEFAULTS_SETTING, {
    name: 'SETTINGS.tokenSizeDefaults.name',
    label: 'SETTINGS.tokenSizeDefaults.label',
    hint: 'SETTINGS.tokenSizeDefaults.hint',
    icon: 'fa-solid fa-expand',
    type: TokenSizeDefaultsConfig,
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

  game.settings.register(SYSTEM_ID, UNIT_MORALE_ENABLED_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.enableUnitMorale.name',
    hint: 'SETTINGS.enableUnitMorale.hint',
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

  game.settings.register(SYSTEM_ID, PUSH_COST_MODE_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.pushCostMode.name',
    hint: 'SETTINGS.pushCostMode.hint',
    type: String,
    choices: {
      [PUSH_COST_MODES.MANUAL]: 'SETTINGS.pushCostMode.choices.manual',
      [PUSH_COST_MODES.BUTTON]: 'SETTINGS.pushCostMode.choices.button',
      [PUSH_COST_MODES.AUTOMATIC]: 'SETTINGS.pushCostMode.choices.automatic',
    },
    default: PUSH_COST_MODES.BUTTON,
  });

  game.settings.register(SYSTEM_ID, INTERNAL_RELOAD_MODE_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.internalMagazineReloadMode.name',
    hint: 'SETTINGS.internalMagazineReloadMode.hint',
    type: String,
    choices: {
      [INTERNAL_RELOAD_MODES.FULL]: 'SETTINGS.internalMagazineReloadMode.choices.full',
      [INTERNAL_RELOAD_MODES.PER_ROUND]: 'SETTINGS.internalMagazineReloadMode.choices.perRound',
    },
    default: INTERNAL_RELOAD_MODES.FULL,
  });

  game.settings.register(SYSTEM_ID, SCENE_GRID_PRESET_SETTING, {
    config: true,
    scope: 'world',
    name: 'SETTINGS.defaultSceneGridPreset.name',
    hint: 'SETTINGS.defaultSceneGridPreset.hint',
    type: String,
    choices: {
      [SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS]: 'SETTINGS.defaultSceneGridPreset.choices.closeQuarters',
      [SCENE_GRID_PRESET_IDS.BATTLE]: 'SETTINGS.defaultSceneGridPreset.choices.battle',
      [SCENE_GRID_PRESET_IDS.CITY]: 'SETTINGS.defaultSceneGridPreset.choices.city',
      [SCENE_GRID_PRESET_IDS.TRAVEL]: 'SETTINGS.defaultSceneGridPreset.choices.travel',
      [SCENE_GRID_PRESET_IDS.SYSTEM]: 'SETTINGS.defaultSceneGridPreset.choices.system',
    },
    default: SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS,
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

  // Kept hidden so worlds using the former shared Character/NPC setting retain
  // that value until the new per-type configuration is explicitly saved.
  game.settings.register(SYSTEM_ID, LEGACY_CHARACTER_TOKEN_SIZE_SETTING, {
    config: false,
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
