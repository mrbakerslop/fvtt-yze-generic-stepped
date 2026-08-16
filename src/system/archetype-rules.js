export const CREATION_SKILL_RATINGS = Object.freeze(['B', 'C', 'C', 'D', 'D', 'D']);

const ATTRIBUTE_RATINGS = Object.freeze({ A: 2, B: 1, C: 0, D: -1 });

export const ATTRIBUTE_INCREASE_BUDGET = 3;

export function linesFromText(value) {
  return String(value ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function parseRankOptions(value) {
  return linesFromText(value).map(line => {
    const [rangePart, ...labelParts] = line.split('|');
    const label = labelParts.join('|').trim();
    const match = rangePart.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match || !label) return null;
    const min = Number(match[1]);
    const max = Number(match[2] ?? match[1]);
    if (max < min) return null;
    return { min, max, label };
  }).filter(Boolean);
}

export function validateAttributeAllocation(attributes) {
  const values = Object.values(attributes ?? {});
  if (values.length !== 4 || values.some(score => !Object.hasOwn(ATTRIBUTE_RATINGS, score))) {
    return ['YZEGS.Archetype.Errors.InvalidAttributes'];
  }
  const errors = [];
  if (values.filter(score => score === 'D').length > 1) {
    errors.push('YZEGS.Archetype.Errors.TooManyReducedAttributes');
  }
  const allocation = getAttributeAllocationCost(attributes);
  if (allocation !== ATTRIBUTE_INCREASE_BUDGET) errors.push('YZEGS.Archetype.Errors.AttributeBudget');
  return errors;
}

export function getAttributeAllocationCost(attributes) {
  return Object.values(attributes ?? {}).reduce((total, score) => (
    total + (ATTRIBUTE_RATINGS[score] ?? 0)
  ), 0);
}

export function canChooseAttributeRating(attributes, attribute, rating) {
  if (!Object.hasOwn(ATTRIBUTE_RATINGS, rating) || !Object.hasOwn(attributes ?? {}, attribute)) return false;
  const allocation = { ...attributes, [attribute]: rating };
  const values = Object.values(allocation);
  return values.filter(score => score === 'D').length <= 1
    && getAttributeAllocationCost(allocation) <= ATTRIBUTE_INCREASE_BUDGET;
}

export function validateSkillAllocation(skills, keySkills = []) {
  const errors = [];
  const entries = Object.entries(skills ?? {});
  if (entries.length !== CREATION_SKILL_RATINGS.length) {
    errors.push('YZEGS.Archetype.Errors.SkillBudget');
    return errors;
  }
  const expected = [...CREATION_SKILL_RATINGS].sort();
  const actual = entries.map(([, rating]) => rating).sort();
  if (actual.join('|') !== expected.join('|')) errors.push('YZEGS.Archetype.Errors.SkillBudget');
  const references = entries.map(([reference]) => reference);
  if (references.some(reference => !reference) || new Set(references).size !== references.length) {
    errors.push('YZEGS.Archetype.Errors.DuplicateSkills');
  }
  const bSkill = entries.find(([, rating]) => rating === 'B')?.[0];
  if (!bSkill || !keySkills.includes(bSkill)) errors.push('YZEGS.Archetype.Errors.KeySkill');
  return errors;
}

export function getCapacityValues(attributes) {
  const dice = { A: 12, B: 10, C: 8, D: 6 };
  return {
    health: Math.ceil((dice[attributes.str] + dice[attributes.agl]) / 4),
    sanity: Math.ceil((dice[attributes.int] + dice[attributes.emp]) / 4),
  };
}
