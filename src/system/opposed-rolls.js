/** Resolve a strict opposed test. The active side must roll more successes. */
export function resolveOpposedRoll({ activeSuccesses = 0, passiveSuccesses = 0 } = {}) {
  const active = Math.max(0, Number(activeSuccesses) || 0);
  const passive = Math.max(0, Number(passiveSuccesses) || 0);
  return {
    activeSuccesses: active,
    passiveSuccesses: passive,
    cancelledSuccesses: Math.min(active, passive),
    netSuccesses: Math.max(0, active - passive),
    won: active > passive,
    tied: active === passive,
  };
}
