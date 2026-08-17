const BLAST_STEPS = Object.freeze(['–', 'D', 'C', 'B', 'A']);

export const DEVIATION_DIRECTIONS = Object.freeze([
  'north', 'northEast', 'southEast', 'south', 'southWest', 'northWest',
]);

export function isMachineGun(itemType = '') {
  return /machine\s*gun|\blmg\b|\bgpmg\b|\bhmg\b/i.test(String(itemType));
}

export function usesHeavyWeaponRules(item) {
  return Boolean(
    item?.type === 'weapon'
    && item.system?.props?.heavyWeapon
    && !isMachineGun(item.system.itemType),
  );
}

export function isArtilleryWeapon(item) {
  return Boolean(
    usesHeavyWeaponRules(item)
    && (item.system.props?.artillery || /mortar|howitzer/i.test(String(item.system.itemType))),
  );
}

export function getHeavyWeaponAttribute(item) {
  if (!usesHeavyWeaponRules(item)) return '';
  if (isArtilleryWeapon(item)) return 'int';
  if (item.system.props?.tripod || item.system.props?.mounted) return 'agl';
  return 'str';
}

export function getHeavyWeaponTargetModifier(item, targetMode = '') {
  return usesHeavyWeaponRules(item) && targetMode === 'individual' ? -2 : 0;
}

export function resolveDeviation(directionRoll, distanceRoll, rangeHexes) {
  const directionIndex = Math.min(6, Math.max(1, Math.trunc(Number(directionRoll) || 1))) - 1;
  const rolledDistance = Math.min(6, Math.max(1, Math.trunc(Number(distanceRoll) || 1)));
  const maximumDistance = Math.max(0, Math.ceil((Number(rangeHexes) || 0) / 2));
  return {
    direction: DEVIATION_DIRECTIONS[directionIndex],
    directionRoll: directionIndex + 1,
    rolledDistance,
    maximumDistance,
    distance: Math.min(rolledDistance, maximumDistance),
  };
}

export function shiftBlastRating(rating, steps = 0) {
  const normalized = String(rating ?? '–').trim().toLocaleUpperCase();
  const index = BLAST_STEPS.indexOf(normalized);
  if (index < 0) return '–';
  return BLAST_STEPS[Math.min(BLAST_STEPS.length - 1, Math.max(0, index + Math.trunc(steps)))];
}

export function getBlastRadius(rating, directional = false) {
  const index = BLAST_STEPS.indexOf(String(rating ?? '–').trim().toLocaleUpperCase());
  if (index < 1) return -1;
  return directional ? (index * 3) - 1 : index - 1;
}

export function getEffectiveBlastRating(rating, {
  distance = 0,
  prone = false,
  airburst = false,
  directional = false,
  indoor = false,
} = {}) {
  const indoorRating = shiftBlastRating(rating, indoor ? 1 : 0);
  const hexes = Math.max(0, Math.ceil(Number(distance) || 0));
  const distanceSteps = directional ? Math.floor(hexes / 3) : hexes;
  const proneSteps = prone && !airburst ? 1 : 0;
  return shiftBlastRating(indoorRating, -(distanceSteps + proneSteps));
}

export function blastCanPenetrateCover(baseDamage, coverArmor, armorModifier = 1) {
  const armor = Math.max(0, Number(coverArmor) || 0) + (Number(armorModifier) || 0);
  return (Number(baseDamage) || 0) > armor - 2;
}
