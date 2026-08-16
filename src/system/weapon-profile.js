export const AMMUNITION_OVERRIDE_FIELDS = Object.freeze([
  'damage',
  'crit',
  'blast',
  'range',
  'armorModifier',
]);

const getSystem = source => source?.system ?? source ?? {};

/**
 * Return the combat profile a Weapon uses with its currently loaded ammunition.
 * Ammunition overrides replace the corresponding base values; they are not bonuses.
 *
 * The returned object contains only serializable values so it can also be saved on a Roll.
 * @param {Item|object} weapon Weapon Item or Weapon system data
 * @param {Item|object|null} ammunition Loaded Ammunition Item or system data
 * @returns {object}
 */
export function getEffectiveWeaponProfile(weapon, ammunition = null) {
  const weaponSystem = getSystem(weapon);
  const ammunitionSystem = getSystem(ammunition);
  const overridden = ammunitionSystem.override === true;
  const profile = {};

  for (const field of AMMUNITION_OVERRIDE_FIELDS) {
    profile[field] = overridden ? ammunitionSystem[field] : weaponSystem[field];
  }

  return {
    ...profile,
    ammunitionId: ammunition?.id ?? null,
    ammunitionName: ammunition?.name ?? '',
    overridden,
  };
}
