export const CLOSE_COMBAT_POSITION_SETTING = 'requireCloseCombatSameGridSpace';

/** Whether this world's close-combat automation enforces token co-location. */
export function requiresCloseCombatSameGridSpace() {
  return game.settings.get('fvtt-yze-generic-stepped', CLOSE_COMBAT_POSITION_SETTING);
}

/** Resolve the positioning rule without depending on Foundry, for workflows and tests. */
export function isCloseCombatPositionAllowed(differentGridSpace, required = true) {
  return !required || !differentGridSpace;
}
