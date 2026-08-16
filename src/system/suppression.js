export const SUPPRESSION_PHASES = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  NARRATIVE: 'narrative',
});

const asCount = value => Math.max(0, Math.trunc(Number(value) || 0));

/** A firearm attack causes a CUF check when it hits or rolls an ammo-die success on a miss. */
export function attackCausesSuppression({ attackSuccesses = 0, ammoSuccesses = 0 } = {}) {
  return asCount(attackSuccesses) > 0 || asCount(ammoSuccesses) > 0;
}

/** One point of Stress reduces the remaining Stress Capacity by one. */
export function applySuppressionStress(current) {
  return Math.max(0, (Number(current) || 0) - 1);
}

/** Whether an Actor is fully protected inside a Vehicle rather than exposed. */
export function getEnclosingVehicle(actor, actors = []) {
  if (!actor) return null;
  for (const vehicle of [...actors]) {
    if (vehicle?.type !== 'vehicle') continue;
    const occupant = vehicle.system?.crew?.occupants?.find(entry => entry.id === actor.id);
    if (occupant && !occupant.exposed) return { vehicle, occupant };
  }
  return null;
}

/** Queue the next-turn action loss caused by a failed CUF check. */
export function queueSuppressionTurn(existing = null, { combatId = '' } = {}) {
  if (!combatId) return { phase: SUPPRESSION_PHASES.NARRATIVE, combatId: '', queued: false };
  if (existing?.combatId === combatId && existing.phase === SUPPRESSION_PHASES.ACTIVE) {
    return { ...existing, queued: true };
  }
  if (existing?.combatId === combatId && existing.phase === SUPPRESSION_PHASES.PENDING) {
    return existing;
  }
  return { phase: SUPPRESSION_PHASES.PENDING, combatId, queued: false };
}

/**
 * Advance an Actor's deferred suppression state as combat changes turns.
 * @returns {{effect: 'none'|'activate'|'clear', state: object|null}}
 */
export function advanceSuppressionTurn(state, { combatId = '', isActorTurn = false } = {}) {
  if (!state) return { effect: 'none', state: null };
  if (!combatId || state.combatId !== combatId) return { effect: 'clear', state: null };

  if (state.phase === SUPPRESSION_PHASES.PENDING && isActorTurn) {
    return {
      effect: 'activate',
      state: { ...state, phase: SUPPRESSION_PHASES.ACTIVE },
    };
  }
  if (state.phase === SUPPRESSION_PHASES.ACTIVE && !isActorTurn) {
    if (state.queued) {
      return {
        effect: 'none',
        state: { ...state, phase: SUPPRESSION_PHASES.PENDING, queued: false },
      };
    }
    return { effect: 'clear', state: null };
  }
  return { effect: 'none', state };
}
