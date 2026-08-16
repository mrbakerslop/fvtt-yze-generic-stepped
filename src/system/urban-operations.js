import { isCloseQuartersScene, isUrbanOperationsScene } from './scene-grid.js';

export const URBAN_SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const CQ_ENGAGEMENT_FLAG = 'closeQuartersEngagedWith';

const BLAST_STEPS = Object.freeze(['–', 'D', 'C', 'B', 'A']);
const BLAST_PROFILES = Object.freeze({
  A: Object.freeze({ die: 12, damage: 4, crit: 3, armorModifier: 1 }),
  B: Object.freeze({ die: 10, damage: 3, crit: 3, armorModifier: 1 }),
  C: Object.freeze({ die: 8, damage: 2, crit: 3, armorModifier: 1 }),
  D: Object.freeze({ die: 6, damage: 1, crit: 2, armorModifier: 1 }),
});

export function getBlastDamageProfile(blast) {
  const rating = String(blast ?? '').trim().toLocaleUpperCase();
  const profile = BLAST_PROFILES[rating];
  return profile ? { rating, ...profile } : null;
}

/** Increase an indoor explosion's blast power by one die step, capped at A. */
export function increaseIndoorBlast(blast) {
  const normalized = String(blast ?? '–').trim().toLocaleUpperCase();
  const index = BLAST_STEPS.indexOf(normalized);
  if (index < 1) return normalized;
  return BLAST_STEPS[Math.min(index + 1, BLAST_STEPS.length - 1)];
}

/** Rules payload for an explosive attack on a Close Quarters Scene. */
export function getUrbanBlastProfile(attack = {}, { indoor = false, contained = false } = {}) {
  const blast = indoor ? increaseIndoorBlast(attack.blast) : attack.blast;
  return {
    ...attack,
    blast,
    indoor: Boolean(indoor),
    contained: Boolean(indoor && contained),
  };
}

/** Blind fire uses ammunition dice only and can suppress but never directly hit. */
export function getBlindFireRoll({ rof = 0, explosive = false } = {}) {
  return {
    attribute: 0,
    skill: 0,
    rof: Math.max(0, Math.trunc(Number(rof) || 0)),
    locate: false,
    canDirectHit: Boolean(explosive),
    canSuppress: !explosive,
    automaticHexHit: Boolean(explosive),
  };
}

/** Urban marching distance per 5–10 minute stretch. */
export function getCityMarchHexes({ road = true } = {}) {
  return road ? 2 : 1;
}

/** City driving uses normal listed travel speed, halved when leaving a main road. */
export function getCityDriveHexes(speed, { offRoad = false, nightMultiplier = 1, terrainMultiplier = 1 } = {}) {
  const listed = Math.max(0, Number(speed) || 0);
  const multiplier = Math.max(0, Number(nightMultiplier) || 0)
    * Math.max(0, Number(terrainMultiplier) || 0)
    * (offRoad ? 0.5 : 1);
  return Math.max(0, Math.floor(listed * multiplier));
}

/** Fuel used by city movement; off-road hexes count double before dividing by fifty. */
export function getCityFuelUsed(consumption, { roadHexes = 0, offRoadHexes = 0, fuelMultiplier = 1 } = {}) {
  const weightedHexes = Math.max(0, Number(roadHexes) || 0) + (2 * Math.max(0, Number(offRoadHexes) || 0));
  const amount = (Math.max(0, Number(consumption) || 0)
    * Math.max(0, Number(fuelMultiplier) || 0)
    * weightedHexes) / 50;
  return Math.round(amount);
}

export function getCloseQuartersMovement(actionId) {
  const movement = {
    enterBuilding: { speed: 'fast', sectors: 1 },
    changeFloor: { speed: 'fast', floors: 1 },
    climbFloor: { speed: 'slow', floors: 1, skill: 'mobility' },
    moveSector: { speed: 'fast', sectors: 1 },
  };
  return movement[actionId] ?? null;
}

/** True when this Scene should offer Urban Operations combat choices. */
export function urbanCombatEnabled(scene = null) {
  return isUrbanOperationsScene(scene);
}

export function closeQuartersCombatEnabled(scene = null) {
  return isCloseQuartersScene(scene);
}

/** Slow actions allowed while two combatants are engaged in close quarters. */
export function isAllowedWhileEngaged(action = {}) {
  if (action.speed !== 'slow') return true;
  return ['unarmedAttack', 'meleeAttack', 'grapple', 'grappleAttack', 'breakFree'].includes(action.id);
}

/** Choose who a third-party ranged attack hits when fired into an engagement. */
export function chooseEngagementTarget(targetUuid, partnerUuid, random = Math.random) {
  if (!targetUuid || !partnerUuid) return targetUuid || partnerUuid || '';
  return Number(random()) < 0.5 ? targetUuid : partnerUuid;
}
