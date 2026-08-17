export const TACTICAL_TERRAIN_PROFILES = Object.freeze({
  pavement: Object.freeze({ movement: 0, ranged: 0, coverArmor: 0, infiltration: -2, visibility: null }),
  field: Object.freeze({ movement: 0, ranged: 0, coverArmor: 0, infiltration: -1, visibility: null }),
  shrubland: Object.freeze({ movement: -1, ranged: -1, coverArmor: 0, infiltration: 0, visibility: null }),
  debris: Object.freeze({ movement: -2, ranged: -1, coverArmor: 3, infiltration: 1, visibility: null }),
  forest: Object.freeze({ movement: -1, ranged: -1, coverArmor: 2, infiltration: 1, visibility: 3 }),
  foliage: Object.freeze({ movement: -3, ranged: -2, coverArmor: 0, infiltration: 2, visibility: 1 }),
  swamp: Object.freeze({
    movement: 0, ranged: 0, coverArmor: 0, infiltration: 1, visibility: null, forcedCrawl: true,
  }),
  shallows: Object.freeze({
    movement: 0, ranged: 0, coverArmor: 0, infiltration: 0, visibility: null, forcedCrawl: true,
  }),
  blocking: Object.freeze({
    movement: 0, ranged: 0, coverArmor: 0, infiltration: 0, visibility: 0, blocking: true,
  }),
  indoors: Object.freeze({ movement: -2, ranged: -1, coverArmor: 1, infiltration: 1, visibility: 0 }),
});

export function getTacticalTerrainProfile(type, custom = {}) {
  if (type !== 'custom') {
    const profile = TACTICAL_TERRAIN_PROFILES[type] ?? TACTICAL_TERRAIN_PROFILES.field;
    return { type: Object.hasOwn(TACTICAL_TERRAIN_PROFILES, type) ? type : 'field', ...profile };
  }
  return {
    type: 'custom',
    name: String(custom.name ?? '').trim(),
    movement: Number(custom.movement) || 0,
    ranged: Number(custom.ranged) || 0,
    coverArmor: Math.max(0, Number(custom.coverArmor) || 0),
    infiltration: Number(custom.infiltration) || 0,
    visibility: custom.visibility === null || custom.visibility === ''
      ? null : Math.max(0, Number(custom.visibility) || 0),
    forcedCrawl: Boolean(custom.forcedCrawl),
    blocking: Boolean(custom.blocking),
  };
}

export function tacticalMovementAllowance(actionId, successes = 0, terrain = {}) {
  successes = Math.max(0, Number(successes) || 0);
  if (terrain.blocking) return { hexes: 0, mode: 'blocked' };
  const crawling = actionId === 'crawl' || Boolean(terrain.forcedCrawl);
  if (crawling) return { hexes: 1 + Math.min(1, successes), mode: 'crawl' };
  return { hexes: 2 + successes, mode: 'run' };
}

export function tacticalMovementModifier(terrain = {}, { backpack = false } = {}) {
  return (Number(terrain.movement) || 0) + (backpack ? -2 : 0);
}

export function terrainProvidesCover(terrain = {}) {
  return Math.max(0, Number(terrain.coverArmor) || 0) > 0;
}
