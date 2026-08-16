const asCount = value => Math.max(0, Math.trunc(Number(value) || 0));

/**
 * Resolve one Twilight: 2000 damage application.
 *
 * The primary hit costs no ammo success and includes extra base-die successes.
 * Every additional hit costs one ammo success; any further successes assigned
 * to that hit increase its damage one-for-one.
 */
export function resolveDamageAllocation({
  baseDamage = 0,
  baseSuccesses = 0,
  ammoSuccesses = 0,
  primaryApplied = false,
  ammoSpend = 0,
  adjustment = 0,
} = {}) {
  baseDamage = asCount(baseDamage);
  baseSuccesses = asCount(baseSuccesses);
  ammoSuccesses = asCount(ammoSuccesses);
  adjustment = Math.trunc(Number(adjustment) || 0);
  if (!baseSuccesses) return { available: false, complete: true };

  const primary = !primaryApplied;
  if (!primary && !ammoSuccesses) return { available: false, complete: true };
  const minimumSpend = primary ? 0 : 1;
  ammoSpend = Math.max(minimumSpend, Math.min(ammoSuccesses, asCount(ammoSpend)));
  const calculatedDamage = primary
    ? baseDamage + Math.max(0, baseSuccesses - 1)
    : baseDamage;
  const ammoBonus = primary ? ammoSpend : Math.max(0, ammoSpend - 1);
  const remainingAmmoSuccesses = Math.max(0, ammoSuccesses - ammoSpend);
  return {
    available: primary || ammoSuccesses > 0,
    primary,
    calculatedDamage,
    ammoSpend,
    ammoBonus,
    adjustment,
    damage: Math.max(0, calculatedDamage + ammoBonus + adjustment),
    remainingAmmoSuccesses,
    primaryApplied: true,
    complete: remainingAmmoSuccesses === 0,
  };
}
