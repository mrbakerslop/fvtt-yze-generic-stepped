const asCount = value => Math.max(0, Math.trunc(Number(value) || 0));

export const BLOCKABLE_ACTIONS = new Set([
  'unarmedAttack',
  'meleeAttack',
  'shove',
  'disarm',
  'grapple',
  'divingBlow',
]);

/** Whether the declared close-combat action permits a Block reaction. */
export function isBlockableAction(actionId) {
  return BLOCKABLE_ACTIONS.has(actionId);
}

/** Apply Block successes to an attack without turning it into an opposed roll. */
export function resolveBlock({ attackSuccesses = 0, blockSuccesses = 0 } = {}) {
  attackSuccesses = asCount(attackSuccesses);
  blockSuccesses = asCount(blockSuccesses);
  const cancelledSuccesses = Math.min(attackSuccesses, blockSuccesses);
  const remainingSuccesses = attackSuccesses - cancelledSuccesses;
  return {
    attackSuccesses,
    blockSuccesses,
    cancelledSuccesses,
    remainingSuccesses,
    blocked: attackSuccesses > 0 && remainingSuccesses === 0,
  };
}

/** Return the attack successes which remain after a completed Block. */
export function getEffectiveAttackSuccesses(roll) {
  const defense = roll?.options?.defense;
  if (defense?.status === 'resolved') return asCount(defense.remainingSuccesses);
  return asCount(roll?.baseSuccessQty);
}

/** Partial cover shields torso and legs; full cover shields every location. */
export function coverProtectsLocation(coverType, hitLocation) {
  if (coverType === 'fullCover') return true;
  return coverType === 'partialCover' && ['torso', 'legs'].includes(hitLocation);
}

/** Determine whether stored directional cover applies against this attacker. */
export function coverAppliesAgainst(cover = {}, attackerUuid = '') {
  if (!cover?.type || !asCount(cover.armor)) return false;
  return !cover.againstUuid || cover.againstUuid === '*' || cover.againstUuid === attackerUuid;
}
