/** Whether a pushed roll jams the Weapon used for it. */
export function causesWeaponJam(roll, item) {
  return Boolean(
    item?.type === 'weapon'
    && !roll?.options?.defenseFor
    && roll?.pushed
    && Number(roll.jamCount) >= 2,
  );
}

/** Resolve whether a Clear Jam attempt can be made and what action it spends. */
export function resolveClearJamAction({ inCombat = false, slow = 0 } = {}) {
  if (!inCombat) return { available: true, spentFrom: null };
  if (Math.max(0, Number(slow) || 0) > 0) return { available: true, spentFrom: 'slow' };
  return { available: false, spentFrom: null };
}

/** Return automatic Item/Specialty modifiers configured for the Clear Jam action. */
export function getClearJamModifier(actor) {
  return actor?.getRollModifiers?.()
    .filter(modifier => modifier.category === 'action' && modifier.target === 'clearJam')
    .reduce((total, modifier) => total + (Number(modifier.value) || 0), 0) ?? 0;
}
