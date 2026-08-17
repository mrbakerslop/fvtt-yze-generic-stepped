export const HAZARD_TIME_SECONDS = Object.freeze({
  round: 6,
  stretch: 600,
  shift: 21600,
  day: 86400,
});

export function normalizeHazardTimeUnit(unit) {
  return Object.hasOwn(HAZARD_TIME_SECONDS, unit) ? unit : 'day';
}

export function hazardDurationSeconds(amount, unit) {
  const numeric = Math.max(0, Number(amount) || 0);
  return numeric * HAZARD_TIME_SECONDS[normalizeHazardTimeUnit(unit)];
}

export function diseaseCheckModifier(disease, { medical = false } = {}) {
  const virulence = Number(disease?.system?.virulence) || 0;
  const state = disease?.system?.state ?? {};
  const treatment = disease?.system?.treatment ?? {};
  const medicine = state.antibioticsUsed && treatment.antibioticsEffective
    ? Number(treatment.antibioticsModifier) || 0
    : 0;
  return virulence + (medical ? medicine : medicine);
}

export function diseaseBlocksRecovery(disease, track) {
  if (!disease || disease.type !== 'disease') return false;
  if (!['incubating', 'active'].includes(disease.system.state?.phase)) return false;
  return track === 'stress'
    ? Boolean(disease.system.recovery?.blocksStress)
    : Boolean(disease.system.recovery?.blocksDamage);
}

export function getDiseaseOutcome({ phase, successes }) {
  if ((Number(successes) || 0) > 0) return { recovered: true, nextPhase: 'recovered' };
  return {
    recovered: false,
    nextPhase: 'active',
    newlyActive: phase !== 'active',
  };
}

export function steppedDieSuccesses(result, faces) {
  const value = Number(result) || 0;
  if (value < 6) return 0;
  if (faces >= 12 && value >= 12) return 3;
  if (faces >= 10 && value >= 10) return 2;
  if (faces >= 8 && value >= 8) return 2;
  return 1;
}

export function fireDieFaces(intensity) {
  return ({ A: 12, B: 10, C: 8, D: 6 })[String(intensity).toLocaleUpperCase()] ?? 8;
}

export function increaseFireIntensity(intensity) {
  return ({ D: 'C', C: 'B', B: 'A', A: 'A' })[String(intensity).toLocaleUpperCase()] ?? 'C';
}
