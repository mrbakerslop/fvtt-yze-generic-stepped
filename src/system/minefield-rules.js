const DENSITY_LIMITS = Object.freeze({ false: 0, sparse: 1, normal: 2, dense: Infinity });
const CONDITION_DUD_THRESHOLDS = Object.freeze({ fresh: 0, old: 1, overgrown: 2 });

/** Calculate the modifier used to detect a minefield. */
export function getMinefieldDetectionModifier({
  mineType = 'antiPersonnel',
  condition = 'fresh',
  mode = 'unaware',
  fromVehicle = false,
  modifier = 0,
} = {}) {
  let result = Number(modifier) || 0;
  if (condition === 'overgrown') result -= 2;
  if (mode === 'probing') result += 2;
  if (mineType === 'antiVehicle') result += 2;
  if (fromVehicle) result -= 2;
  return result;
}

/** Number of independent trigger checks made for movement through a minefield. */
export function getMinefieldExposureCount({ density = 'normal', hexes = 1, entrants = 1 } = {}) {
  const limit = DENSITY_LIMITS[density] ?? DENSITY_LIMITS.normal;
  const affectedEntrants = Math.min(Math.max(0, Math.trunc(Number(entrants) || 0)), limit);
  return Math.max(0, Math.trunc(Number(hexes) || 0)) * affectedEntrants;
}

/** Careful probing changes the mine trigger check from a D6 to a D10. */
export function getMinefieldTriggerDie(mode = 'unaware') {
  return mode === 'probing' ? 10 : 6;
}

export function countMinefieldTriggers(results = []) {
  return results.filter(result => Number(result) === 1).length;
}

export function getMinefieldDudThreshold(condition = 'fresh') {
  return CONDITION_DUD_THRESHOLDS[condition] ?? CONDITION_DUD_THRESHOLDS.fresh;
}

export function resolveMinefieldTriggers(triggerResults = [], dudResults = [], condition = 'fresh') {
  const attempts = countMinefieldTriggers(triggerResults);
  const threshold = getMinefieldDudThreshold(condition);
  const duds = dudResults.slice(0, attempts).filter(result => Number(result) <= threshold).length;
  return { attempts, duds, detonations: Math.max(0, attempts - duds) };
}

/** Whether this class of mine can be triggered by the moving Actor. */
export function minefieldAffectsActor(mineType = 'antiPersonnel', actorType = '') {
  if (mineType === 'mixed') return ['character', 'npc', 'vehicle'].includes(actorType);
  if (mineType === 'antiVehicle') return actorType === 'vehicle';
  return ['character', 'npc'].includes(actorType);
}
