const DEFAULT_LOCATION_LABELS = Object.freeze({
  1: 'L',
  2: 'T',
  3: 'T',
  4: 'T',
  5: 'A',
  6: 'H',
});
const NAMED_HIT_LOCATIONS = new Set(['head', 'arms', 'torso', 'legs']);

/** Convert a numeric or displayed hit-die result back to its numeric face. */
export function normalizeHitLocationResult(value, labels = DEFAULT_LOCATION_LABELS) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 6) return numeric;

  const displayed = String(value ?? '').trim().toLocaleUpperCase();
  if (!displayed) return null;
  const match = Object.entries(labels).find(([, label]) => (
    String(label).trim().toLocaleUpperCase() === displayed
  ));
  return match ? Number(match[0]) : null;
}

/** Normalize all active results supplied by a serialized Location Die. */
export function normalizeHitLocationResults(values, labels = DEFAULT_LOCATION_LABELS) {
  return (values ?? [])
    .map(value => normalizeHitLocationResult(value, labels))
    .filter(value => value !== null);
}

/** Return the translation key for a rolled or deliberately selected hit location. */
export function getHitLocationLocalizationKey(value, labels = DEFAULT_LOCATION_LABELS) {
  const named = String(value ?? '').trim().toLocaleLowerCase();
  if (NAMED_HIT_LOCATIONS.has(named)) return `YZEGS.ArmorLocationNames.${named}`;
  const numeric = normalizeHitLocationResult(value, labels);
  return numeric ? `YZUR.CHAT.ROLL.Locations.${numeric}` : '';
}
