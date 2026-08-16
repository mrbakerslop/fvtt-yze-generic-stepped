import { getLegacySkillKey, LEGACY_SKILLS } from './legacy-skills.js';
import { TWILIGHT_ACTIONS } from './twilight-actions.js';
import { closeQuartersCombatEnabled, urbanCombatEnabled } from './urban-operations.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const ACTION_SKILLS_SETTING = 'actionSkills';

const DEDICATED_ITEM_WORKFLOWS = new Set(['attack', 'clearJam', 'reload']);

const actionDefinition = (id, label, skill, group = 'actions') => Object.freeze({
  id, label, skill, group,
});

const registryActions = TWILIGHT_ACTIONS
  .filter(action => action.skill && action.skill !== 'weaponSkill' && !DEDICATED_ITEM_WORKFLOWS.has(action.workflow))
  .map(action => actionDefinition(action.id, action.label, action.skill));

/** Checks launched outside the ordinary action selector, including Travel Party rolls. */
const supportingActions = [
  actionDefinition('travel-forced-march', 'FLPS.TRAVEL_ROLL.FORCED_MARCH', 'stamina', 'travel'),
  actionDefinition('travel-march-in-darkness', 'FLPS.TRAVEL_ROLL.MARCH_IN_DARKNESS', 'survival', 'travel'),
  actionDefinition('travel-drive', 'FLPS.TRAVEL_ROLL.DRIVE', 'driving', 'travel'),
  actionDefinition('travel-keep-watch', 'FLPS.TRAVEL_ROLL.KEEP_WATCH', 'recon', 'travel'),
  actionDefinition('travel-find-scrap', 'FLPS.TRAVEL_ROLL.FIND_SCRAP', 'survival', 'travel'),
  actionDefinition('travel-find-food', 'FLPS.TRAVEL_ROLL.FIND_FOOD', 'survival', 'travel'),
  actionDefinition('travel-find-prey', 'FLPS.TRAVEL_ROLL.FIND_PREY', 'survival', 'travel'),
  actionDefinition('travel-recon-prey', 'FLPS.TRAVEL_ROLL.RECON_PREY', 'recon', 'travel'),
  actionDefinition('travel-kill-prey', 'FLPS.TRAVEL_ROLL.KILL_PREY', 'rangedCombat', 'travel'),
  actionDefinition('travel-catch-fish', 'FLPS.TRAVEL_ROLL.CATCH_FISH', 'survival', 'travel'),
  actionDefinition('travel-make-camp', 'FLPS.TRAVEL_ROLL.MAKE_CAMP', 'survival', 'travel'),
  actionDefinition('travel-hide-camp', 'FLPS.TRAVEL_ROLL.HIDE_CAMP', 'recon', 'travel'),
  actionDefinition('travel-cook-food', 'FLPS.TRAVEL_ROLL.COOK_FOOD', 'survival', 'travel'),
  actionDefinition('waterTravelNavigation', 'YZEGS.WaterTravel.NavigationCheck', 'survival', 'supporting'),
  actionDefinition('waterTravelDriving', 'YZEGS.ActionSkillConfig.WaterTravelDriving', 'driving', 'supporting'),
  actionDefinition('waterTravelFishing', 'YZEGS.WaterTravel.FishingCheck', 'survival', 'supporting'),
  actionDefinition('landVessel', 'YZEGS.Watercraft.Actions.Landing', 'driving', 'supporting'),
  actionDefinition('repairComponent', 'YZEGS.Watercraft.Actions.RepairComponent', 'tech', 'supporting'),
  actionDefinition('waterMineAvoidance', 'YZEGS.ActionSkillConfig.WaterMineAvoidance', 'driving', 'supporting'),
  actionDefinition('coldWaterCheck', 'YZEGS.ActionSkillConfig.ColdWaterCheck', 'stamina', 'supporting'),
  actionDefinition('radiationCheck', 'YZEGS.ActorSheet.RadiationRoll', 'stamina', 'supporting'),
];

export const ACTION_SKILL_DEFINITIONS = Object.freeze([...registryActions, ...supportingActions]);
export const ACTION_SKILL_DEFINITION_MAP = new Map(ACTION_SKILL_DEFINITIONS.map(entry => [entry.id, entry]));

/** Return a safe copy of the stored world mappings. */
export function getActionSkillMappings() {
  return foundry.utils.deepClone(game.settings.get(SYSTEM_ID, ACTION_SKILLS_SETTING) ?? {});
}

/** Return the configured reference, falling back to the action's built-in legacy Skill key. */
export function getActionSkillReference(actionId, fallbackSkill = '') {
  const definition = ACTION_SKILL_DEFINITION_MAP.get(actionId);
  const fallback = fallbackSkill || definition?.skill || '';
  const configured = getActionSkillMappings()[actionId];
  if (configured?.uuid || configured?.legacyKey || configured?.name) return configured;
  return fallback ? { legacyKey: fallback, name: getLegacySkillName(fallback) } : null;
}

/** Resolve the embedded Skill an Actor uses for an automated action. */
export function getActorActionSkill(actor, actionId, fallbackSkill = '') {
  if (!actor?.getSkill) return null;
  const reference = getActionSkillReference(actionId, fallbackSkill);
  return reference ? actor.getSkill(reference) : null;
}

/** Display name used by missing-Skill messages and configuration summaries. */
export function getActionSkillName(actionId, fallbackSkill = '') {
  const reference = getActionSkillReference(actionId, fallbackSkill);
  return reference?.name || getLegacySkillName(reference?.legacyKey ?? fallbackSkill);
}

/** Whether an embedded Skill is the configured Skill for an action. */
export function skillMatchesAction(skill, actionId, fallbackSkill = '') {
  if (!skill || skill.type !== 'skill') return false;
  const reference = getActionSkillReference(actionId, fallbackSkill);
  if (!reference) return false;
  if (reference.legacyKey) return getLegacySkillKey(skill) === reference.legacyKey;
  const sourceId = skill.getFlag?.('core', 'sourceId');
  if (reference.uuid && [skill.uuid, skill.id, sourceId].includes(reference.uuid)) return true;
  return Boolean(reference.name && skill.name.localeCompare(
    reference.name,
    game.i18n.lang,
    { sensitivity: 'base' },
  ) === 0);
}

/** Actions which should be offered from the supplied embedded Skill's roll dialog. */
export function getConfiguredSkillRollActions(skill) {
  const dedicatedWorkflows = new Set(['attack', 'clearJam', 'reload']);
  return TWILIGHT_ACTIONS.filter(action => (
    action.skill
    && action.launcher
    && (!action.urbanOnly || urbanCombatEnabled())
    && (!action.closeQuartersOnly || closeQuartersCombatEnabled())
    && (!action.closeQuartersExcluded || !closeQuartersCombatEnabled())
    && !dedicatedWorkflows.has(action.workflow)
    && skillMatchesAction(skill, action.id, action.skill)
  ));
}

export function getLegacySkillName(skillKey) {
  const label = LEGACY_SKILLS[skillKey]?.label;
  return label ? game.i18n.localize(label) : skillKey;
}
