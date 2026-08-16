const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const TOKEN_SIZE_DEFAULTS_SETTING = 'tokenSizeDefaults';
export const LEGACY_CHARACTER_TOKEN_SIZE_SETTING = 'defaultCharTokenSize';
export const TOKEN_SIZE_MIN = 0.25;
export const TOKEN_SIZE_MAX = 10;

export const TOKEN_SIZE_ACTOR_TYPES = Object.freeze([
  'character',
  'npc',
  'vehicle',
  'unit',
  'party',
  'container',
]);

export const DEFAULT_TOKEN_SIZE_DEFAULTS = Object.freeze(Object.fromEntries(
  TOKEN_SIZE_ACTOR_TYPES.map(type => [type, Object.freeze({ width: 1, height: 1 })]),
));

/** Return a finite token dimension within the supported configuration range. */
export function normalizeTokenDimension(value, fallback = 1) {
  const dimension = Number(value);
  if (!Number.isFinite(dimension) || dimension < TOKEN_SIZE_MIN || dimension > TOKEN_SIZE_MAX) {
    return fallback;
  }
  return Math.round(dimension * 100) / 100;
}

/** Merge a stored token configuration with defaults and the former PC/NPC setting. */
export function normalizeTokenSizeDefaults(stored = {}, legacyCharacterSize = 1) {
  const legacySize = normalizeTokenDimension(legacyCharacterSize, 1);
  return Object.fromEntries(TOKEN_SIZE_ACTOR_TYPES.map(type => {
    const fallbackSize = ['character', 'npc'].includes(type) ? legacySize : 1;
    const configured = stored?.[type] ?? {};
    return [type, {
      width: normalizeTokenDimension(configured.width, fallbackSize),
      height: normalizeTokenDimension(configured.height, fallbackSize),
    }];
  }));
}

/** Return the world's configured Prototype Token dimensions for every Actor type. */
export function getTokenSizeDefaults() {
  const settingKey = `${SYSTEM_ID}.${TOKEN_SIZE_DEFAULTS_SETTING}`;
  const hasStoredConfiguration = game.settings.storage.get('world').has(settingKey);
  const configured = hasStoredConfiguration
    ? game.settings.get(SYSTEM_ID, TOKEN_SIZE_DEFAULTS_SETTING)
    : {};
  const legacySize = game.settings.get(SYSTEM_ID, LEGACY_CHARACTER_TOKEN_SIZE_SETTING);
  return normalizeTokenSizeDefaults(configured, legacySize);
}

/** Return a safe copy of the default Prototype Token dimensions for an Actor type. */
export function getDefaultTokenDimensions(actorType) {
  const dimensions = getTokenSizeDefaults()[actorType];
  return dimensions ? { ...dimensions } : null;
}
