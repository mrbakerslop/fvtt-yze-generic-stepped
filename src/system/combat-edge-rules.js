export const RANGE_BANDS = Object.freeze({
  SAME_HEX: 'sameHex',
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long',
  EXTREME: 'extreme',
  OUT_OF_RANGE: 'outOfRange',
});

export function getRangeBand(distance, shortRange, sameHex = false) {
  if (sameHex) return RANGE_BANDS.SAME_HEX;
  distance = Math.max(0, Number(distance) || 0);
  shortRange = Math.max(0, Number(shortRange) || 0);
  if (!shortRange || distance > shortRange * 8) return RANGE_BANDS.OUT_OF_RANGE;
  if (distance <= shortRange) return RANGE_BANDS.SHORT;
  if (distance <= shortRange * 2) return RANGE_BANDS.MEDIUM;
  if (distance <= shortRange * 4) return RANGE_BANDS.LONG;
  return RANGE_BANDS.EXTREME;
}

export function getRangeModifier(band, { shotgun = false } = {}) {
  if (shotgun) return 0;
  return {
    [RANGE_BANDS.MEDIUM]: -1,
    [RANGE_BANDS.LONG]: -2,
    [RANGE_BANDS.EXTREME]: -3,
  }[band] ?? 0;
}

export function getShotgunDamageReduction(band) {
  return {
    [RANGE_BANDS.MEDIUM]: 1,
    [RANGE_BANDS.LONG]: 2,
    [RANGE_BANDS.EXTREME]: 3,
  }[band] ?? 0;
}

export function isHandyRangedWeapon(itemType = '') {
  return /pistol|carbine|submachine|\bsmg\b/i.test(String(itemType));
}

export function getSameHexRangedModifier(itemType = '') {
  return isHandyRangedWeapon(itemType) ? -1 : -2;
}

export function getOneHandedRule(itemType = '') {
  const type = String(itemType).toLocaleLowerCase();
  if (/machine\s*gun|\blmg\b|\bgpmg\b|\bhmg\b/.test(type)) {
    return { allowed: false, modifier: 0, shortOnly: false };
  }
  if (/pistol/.test(type)) return { allowed: true, modifier: 0, shortOnly: false };
  if (/carbine|submachine|\bsmg\b/.test(type)) {
    return { allowed: true, modifier: -2, shortOnly: false };
  }
  if (/rifle/.test(type)) return { allowed: true, modifier: -3, shortOnly: true };
  return { allowed: false, modifier: 0, shortOnly: false };
}

export function getMachineGunSupportRule(itemType = '', props = {}) {
  const type = String(itemType).toLocaleLowerCase();
  const supported = Boolean(props.bipod || props.tripod || props.mounted);
  if (/heavy machine|\bhmg\b/.test(type)) {
    return { machineGun: true, blocked: !(props.tripod || props.mounted), modifier: 0 };
  }
  if (/general purpose|\bgpmg\b/.test(type)) {
    return { machineGun: true, blocked: false, modifier: supported ? 0 : -3 };
  }
  if (/light machine|\blmg\b/.test(type)) {
    return { machineGun: true, blocked: false, modifier: supported ? 0 : -2 };
  }
  return { machineGun: false, blocked: false, modifier: 0 };
}

export function getCloseCombatEdges({ attackerProne = false, targetProne = false, defenseless = false } = {}) {
  const modifiers = [];
  if (attackerProne) modifiers.push({ id: 'close-attacker-prone', value: -2 });
  if (defenseless) modifiers.push({ id: 'close-defenseless-target', value: 3 });
  else if (targetProne) modifiers.push({ id: 'close-target-prone', value: 2 });
  return {
    modifiers,
    forcedLocation: attackerProne && !targetProne ? 'legs' : '',
  };
}

export function getRangedCombatEdges({
  band,
  itemType = '',
  shotgun = false,
  targetProne = false,
  defenseless = false,
  largeTarget = false,
  supportRule = null,
  targetMoved = false,
  firingFromMovingVehicle = false,
  elevated = false,
} = {}) {
  const modifiers = [];
  const sameHex = band === RANGE_BANDS.SAME_HEX;
  if (sameHex) {
    if (defenseless) {
      modifiers.push({ id: 'ranged-defenseless-same-hex', value: 3 });
    }
    else {
      modifiers.push({
        id: isHandyRangedWeapon(itemType)
          ? 'ranged-active-same-hex-handy'
          : 'ranged-active-same-hex-other',
        value: getSameHexRangedModifier(itemType),
      });
    }
  }
  else {
    const rangeModifier = getRangeModifier(band, { shotgun });
    if (rangeModifier) modifiers.push({ id: `ranged-${band}-range`, value: rangeModifier });
    if (targetProne) modifiers.push({ id: 'ranged-target-prone', value: -1 });
  }
  if (largeTarget) modifiers.push({ id: 'ranged-large-target', value: 2 });
  if (targetMoved) modifiers.push({ id: 'ranged-moving-target', value: -1 });
  if (firingFromMovingVehicle) modifiers.push({ id: 'ranged-moving-vehicle', value: -2 });
  if (elevated) modifiers.push({ id: 'ranged-elevated-position', value: 1 });
  if (supportRule?.modifier) {
    modifiers.push({
      id: supportRule.modifier === -2 ? 'ranged-unsupported-lmg' : 'ranged-unsupported-gpmg',
      value: supportRule.modifier,
    });
  }
  return {
    modifiers,
    damageReduction: shotgun ? getShotgunDamageReduction(band) : 0,
    outOfRange: band === RANGE_BANDS.OUT_OF_RANGE,
    unsupported: Boolean(supportRule?.blocked),
  };
}
