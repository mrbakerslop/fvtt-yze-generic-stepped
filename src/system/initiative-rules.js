export const INITIATIVE_CARDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

export const AMBUSH_RANGE_MODIFIERS = Object.freeze({
  same: -2,
  one: -1,
  twoToFive: 0,
  sixToTwenty: 1,
  twentyOnePlus: 2,
});

export const WAYLAY_SETUP_MODIFIERS = Object.freeze({
  action: 0,
  stretch: 2,
  shift: 3,
});

export function availableInitiativeCards(initiatives = []) {
  const used = new Set(initiatives.map(Number).filter(value => INITIATIVE_CARDS.includes(value)));
  return INITIATIVE_CARDS.filter(value => !used.has(value));
}

export function drawInitiativeCandidates(cards, count = 1, random = Math.random) {
  const pool = [...cards];
  const drawn = [];
  count = Math.max(0, Math.min(pool.length, Math.trunc(Number(count) || 0)));
  while (drawn.length < count) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    drawn.push(pool.splice(Math.max(0, index), 1)[0]);
  }
  return drawn;
}

export function chooseInitiativeCard(cards = []) {
  return cards.length ? Math.min(...cards.map(Number)) : null;
}

export function resolveAmbush({ attackerSuccesses = 0, targetSuccesses = 0 } = {}) {
  attackerSuccesses = Math.max(0, Number(attackerSuccesses) || 0);
  targetSuccesses = Math.max(0, Number(targetSuccesses) || 0);
  return {
    attackerSuccesses,
    targetSuccesses,
    netSuccesses: Math.max(0, attackerSuccesses - targetSuccesses),
    success: attackerSuccesses > targetSuccesses,
    tied: attackerSuccesses === targetSuccesses,
  };
}

export function getAmbushRangeModifier(range) {
  return Number(AMBUSH_RANGE_MODIFIERS[range]) || 0;
}

export function getWaylaySetupModifier(duration) {
  return Number(WAYLAY_SETUP_MODIFIERS[duration]) || 0;
}

export function topInitiativeCards(count = 0) {
  return INITIATIVE_CARDS.slice(0, Math.max(0, Math.trunc(Number(count) || 0)));
}

/** Sort combatants from the lowest initiative card to the highest, with unresolved entries last. */
export function compareInitiativeCards(left, right) {
  const leftCard = left?.initiative === null || left?.initiative === undefined
    ? Number.POSITIVE_INFINITY
    : Number(left.initiative);
  const rightCard = right?.initiative === null || right?.initiative === undefined
    ? Number.POSITIVE_INFINITY
    : Number(right.initiative);
  const cardDifference = leftCard - rightCard;
  if (Number.isFinite(cardDifference) && cardDifference !== 0) return cardDifference;
  return String(left?.name ?? left?.id ?? '').localeCompare(String(right?.name ?? right?.id ?? ''));
}
