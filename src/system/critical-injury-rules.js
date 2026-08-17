export const CRITICAL_TIME_SECONDS = Object.freeze({ round: 10, stretch: 600, shift: 21600 });

const STAGE_ORDER = Object.freeze(['round', 'stretch', 'shift', 'stabilized']);

export function normalizeTimeLimit(value) {
  const normalized = String(value ?? '').trim().toLocaleLowerCase();
  if (normalized.includes('round')) return 'round';
  if (normalized.includes('stretch')) return 'stretch';
  if (normalized.includes('shift')) return 'shift';
  return '';
}

export function criticalSeverityDice(damage, criticalRating) {
  damage = Number(damage) || 0;
  criticalRating = Number(criticalRating) || 0;
  if (criticalRating <= 0 || damage < criticalRating) return 0;
  return 1 + Math.floor(Math.max(0, damage - criticalRating) / 2);
}

export function nextStabilizationStage(stage) {
  const index = STAGE_ORDER.indexOf(stage);
  return index < 0 ? 'stabilized' : STAGE_ORDER[Math.min(index + 1, STAGE_ORDER.length - 1)];
}
