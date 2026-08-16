const asCount = value => Math.max(0, Math.trunc(Number(value) || 0));

/**
 * Resolve a selected combat action against the Character's tracked action pools.
 * A Slow action may be converted into a second Fast action, but not vice versa.
 */
export function resolveCombatActionSpend({ inCombat = false, speed = '', fast = 0, slow = 0 } = {}) {
  fast = asCount(fast);
  slow = asCount(slow);
  const remaining = { fast, slow };

  if (!inCombat || !['fast', 'slow'].includes(speed)) {
    return { tracked: false, available: true, spentFrom: null, remaining };
  }
  if (speed === 'slow') {
    if (slow <= 0) return { tracked: true, available: false, spentFrom: null, remaining };
    remaining.slow--;
    return { tracked: true, available: true, spentFrom: 'slow', remaining };
  }
  if (fast > 0) {
    remaining.fast--;
    return { tracked: true, available: true, spentFrom: 'fast', remaining };
  }
  if (slow > 0) {
    remaining.slow--;
    return { tracked: true, available: true, spentFrom: 'slow', remaining };
  }
  return { tracked: true, available: false, spentFrom: null, remaining };
}

/** Whether a Combat update has entered a playable round. */
export function startsCombatRound(changes = {}) {
  return Object.hasOwn(changes, 'round') && Number(changes.round) > 0;
}

/** Build the update which restores an Actor's action pools to their configured maxima. */
export function getCombatActionResetUpdate(actor) {
  const actions = actor?.system?.actions;
  if (!actions?.fast || !actions?.slow) return null;
  return {
    'system.actions.fast.value': asCount(actions.fast.max),
    'system.actions.slow.value': asCount(actions.slow.max),
  };
}

/** Reset each unique Character and NPC combatant at the start of a new round. */
export async function resetCombatantActions(combat, changes, userId) {
  if (!startsCombatRound(changes)) return [];
  // Every client receives updateCombat. Only the GM who advanced the encounter performs writes.
  if (!game.user.isGM || userId !== game.user.id) return [];

  const actors = [];
  const seen = new Set();
  for (const combatant of [...(combat?.combatants ?? [])]) {
    const actor = combatant.actor;
    if (!['character', 'npc'].includes(actor?.type)) continue;
    const key = actor.uuid ?? actor.id;
    if (!key || seen.has(key)) continue;
    const update = getCombatActionResetUpdate(actor);
    if (!update) continue;
    seen.add(key);
    actors.push({ actor, update });
  }

  await Promise.all(actors.map(({ actor, update }) => actor.update(update)));
  return actors.map(({ actor }) => actor);
}
