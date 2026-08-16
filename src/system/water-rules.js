/** Pure helpers for water movement, vessel damage, hazards, and travel. */

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const WATER_TRAVEL_TERRAINS = Object.freeze({
  river: Object.freeze({ speed: 1, drivingModifier: 2, fishingModifier: 1, encounterMultiplier: 2 }),
  coast: Object.freeze({ speed: 1, drivingModifier: 1, fishingModifier: 0, encounterMultiplier: 4 }),
  openWater: Object.freeze({ speed: 1, drivingModifier: 1, fishingModifier: 0, encounterMultiplier: 4 }),
});

export const WATERCRAFT_COMPONENTS = Object.freeze({
  penetrated: Object.freeze([
    'hull', 'engine', 'fuel', 'ammunition', 'cargo',
    'driver', 'passenger', 'gunner', 'captain', 'radio',
  ]),
  surface: Object.freeze([
    'weapon', 'fcs', 'antenna', 'mastRigging', 'externalStores',
    'mastRigging', 'externalStores', 'exposedPassenger', 'exposedPassenger', 'ricochet',
  ]),
});

export function getWatercraftComponent(result, penetrated = false) {
  const table = penetrated ? WATERCRAFT_COMPONENTS.penetrated : WATERCRAFT_COMPONENTS.surface;
  const index = clamp(Math.trunc(Number(result) || 1), 1, table.length) - 1;
  return table[index];
}

export function getLargeVesselTurnCost(size = 1) {
  return Math.max(0, Math.trunc(Number(size) || 1) - 1);
}

export function getGroundingDamage(results = []) {
  return results.filter(result => Number(result) >= 6).length;
}

export function getCollisionDamage(otherVesselSize = 1) {
  return Math.max(1, Math.trunc(Number(otherVesselSize) || 1));
}

export function getRammingDamage(otherVesselSize = 1, drivingSuccesses = 0) {
  return getCollisionDamage(otherVesselSize) + Math.max(0, Math.trunc(Number(drivingSuccesses) || 0));
}

export function advanceSinking({ size = 1, progress = 0, breaches = 0, results = [] } = {}) {
  const added = results.filter(result => Number(result) === 1).length;
  const nextProgress = Math.max(0, Math.trunc(Number(progress) || 0)) + added;
  const vesselSize = Math.max(1, Math.trunc(Number(size) || 1));
  return {
    dice: Math.max(0, Math.trunc(Number(breaches) || 0)),
    added,
    progress: nextProgress,
    sunk: nextProgress >= vesselSize,
  };
}

export function getWaterTravelProfile(terrain = 'river', { night = false } = {}) {
  const profile = WATER_TRAVEL_TERRAINS[terrain] ?? WATER_TRAVEL_TERRAINS.river;
  return {
    ...profile,
    speed: profile.speed * (night ? 0.5 : 1),
  };
}

export function canWaterMineAffectVessel(vesselSize = 1, maximumSafeSize = 0) {
  return Math.max(1, Number(vesselSize) || 1) > Math.max(0, Number(maximumSafeSize) || 0);
}

export function isValidGuidedWeaponTarget(targetClass = 'any', actor = null) {
  if (!actor) return false;
  if (targetClass === 'any') return true;
  if (targetClass === 'aircraft') return actor.type === 'vehicle' && actor.system?.movement?.type === 'A';
  if (targetClass === 'watercraft') {
    return actor.type === 'vehicle' && ['watercraft', 'amphibious'].includes(actor.system?.domain);
  }
  if (targetClass === 'largeVessel') {
    return actor.type === 'vehicle'
      && ['watercraft', 'amphibious'].includes(actor.system?.domain)
      && Number(actor.system?.watercraft?.size) >= 2;
  }
  if (targetClass === 'groundOrWater') {
    return actor.type === 'vehicle' && actor.system?.movement?.type !== 'A';
  }
  return false;
}

/** Check a four-quadrant firing arc using Foundry token rotation (0° is north). */
export function targetInFiringArc(source, target, arc = 'all') {
  if (arc === 'all' || !source || !target) return true;
  const sourceCenter = source.center ?? { x: Number(source.x) || 0, y: Number(source.y) || 0 };
  const targetCenter = target.center ?? { x: Number(target.x) || 0, y: Number(target.y) || 0 };
  const bearing = (Math.atan2(targetCenter.x - sourceCenter.x, -(targetCenter.y - sourceCenter.y))
    * 180 / Math.PI + 360) % 360;
  const rotation = ((Number(source.document?.rotation ?? source.rotation) || 0) % 360 + 360) % 360;
  const relative = (bearing - rotation + 360) % 360;
  if (arc === 'front') return relative <= 45 || relative >= 315;
  if (arc === 'starboard') return relative >= 45 && relative <= 135;
  if (arc === 'rear') return relative >= 135 && relative <= 225;
  if (arc === 'port') return relative >= 225 && relative <= 315;
  return true;
}

export function getWaterMishap(total = 7, propulsion = 'motor', terrain = 'river') {
  const value = clamp(Math.trunc(Number(total) || 7), 2, 12);
  if (value === 2) return propulsion === 'sail' ? 'mastBroken' : 'engineBlown';
  if (value <= 4) return propulsion === 'sail' ? 'riggingDamaged' : 'propulsionDamaged';
  if (value === 5) return 'debrisCollision';
  if (value === 6) return terrain === 'river' ? 'grounding' : 'largeWave';
  if (value === 7) return 'lost';
  if (value === 8) return 'minorLeak';
  if (value === 9) return propulsion === 'sail' ? 'deadCalm' : 'forcedStop';
  if (value <= 11) return propulsion === 'sail' ? 'unfavorableWind' : 'contaminatedFuel';
  return 'majorLeak';
}
