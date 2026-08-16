/**
 * Whether a Weapon is configured to use ammunition belts.
 * @param {Item|object} weapon Weapon Item
 * @returns {boolean}
 */
export function weaponUsesAmmoBelt(weapon) {
  return weapon?.type === 'weapon' && !!weapon.system?.props?.ammoBelt;
}

/**
 * Whether a Weapon is configured to use detachable magazines.
 * @param {Item|object} weapon Weapon Item
 * @returns {boolean}
 */
export function weaponUsesMagazine(weapon) {
  return weapon?.type === 'weapon' && !!weapon.system?.props?.magazineFed;
}

/**
 * Whether a Weapon has an internal store which is loaded one round at a time.
 * @param {Item|object} weapon Weapon Item
 * @returns {boolean}
 */
export function weaponUsesInternalMagazine(weapon) {
  return weapon?.type === 'weapon' && !!weapon.system?.props?.internalMagazine;
}

/**
 * Whether an Ammunition Item is an ammunition belt.
 * @param {Item|object} ammunition Ammunition Item
 * @returns {boolean}
 */
export function isAmmoBelt(ammunition) {
  return ammunition?.type === 'ammunition' && !!ammunition.system?.props?.ammoBelt;
}

/**
 * Whether an Ammunition Item is a detachable magazine.
 * @param {Item|object} ammunition Ammunition Item
 * @returns {boolean}
 */
export function isMagazine(ammunition) {
  return ammunition?.type === 'ammunition' && !!ammunition.system?.props?.magazine;
}

/**
 * Whether an Ammunition Item is a purchasable box rather than a loadable target.
 * @param {Item|object} ammunition Ammunition Item
 * @returns {boolean}
 */
export function isAmmoBox(ammunition) {
  return ammunition?.type === 'ammunition' && !!ammunition.system?.props?.ammoBox;
}

/**
 * Normalize an ammunition identifier for compatibility comparisons.
 * @param {unknown} value Ammunition identifier
 * @returns {string}
 */
export function normalizeAmmunitionType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/gu, '') : '';
}

/**
 * Whether an Ammunition Item has the identifier required by a Weapon.
 * @param {Item|object} weapon Weapon Item
 * @param {Item|object} ammunition Ammunition Item
 * @returns {boolean}
 */
export function hasMatchingAmmunitionType(weapon, ammunition) {
  const weaponType = normalizeAmmunitionType(weapon?.system?.ammo);
  const ammunitionType = normalizeAmmunitionType(ammunition?.system?.itemType);
  return !!weaponType && weaponType === ammunitionType;
}

/**
 * Test whether an ammunition target can be loaded into a Weapon.
 * Both the feed system and ammunition identifier must match.
 * @param {Item|object} weapon Weapon Item
 * @param {Item|object} ammunition Ammunition target
 * @returns {boolean}
 */
export function isCompatibleWeaponAmmunition(weapon, ammunition) {
  if (weapon?.type !== 'weapon' || !ammunition) return false;
  if (ammunition.type !== 'ammunition') return false;
  if (!hasMatchingAmmunitionType(weapon, ammunition)) return false;
  if (isAmmoBox(ammunition)) return false;
  if (weaponUsesAmmoBelt(weapon)) return isAmmoBelt(ammunition);
  if (weaponUsesMagazine(weapon)) return isMagazine(ammunition);
  if (weaponUsesInternalMagazine(weapon)) {
    return !(isAmmoBelt(ammunition) || isMagazine(ammunition));
  }
  return !(isAmmoBelt(ammunition) || isMagazine(ammunition));
}
