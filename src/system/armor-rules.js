export const STACK_BODY_ARMOR_SETTING = 'stackBodyArmorLayers';
export const SEPARATE_COVER_ARMOR_SETTING = 'separateCoverArmor';

const armorRating = item => Math.max(0, Number(item?.system?.rating?.value) || 0);

/** Return the equipped armor Items which contribute at one hit location. */
export function getContributingBodyArmor(armors, hitLocation, { stack = false } = {}) {
  const applicable = [...(armors ?? [])].filter(item => (
    item?.type === 'armor'
    && item.system?.equipped
    && item.system?.location?.[hitLocation]
    && armorRating(item) > 0
  ));
  if (stack || applicable.length < 2) return applicable;

  const bestRating = Math.max(...applicable.map(armorRating));
  return [applicable.find(item => armorRating(item) === bestRating)];
}

/** Add the current ratings of all contributing body-armor Items. */
export function getBodyArmorRating(armors) {
  return [...(armors ?? [])].reduce((total, item) => total + armorRating(item), 0);
}

/** Resolve one protection rating without rolling its ablation check. */
export function resolveArmorProtection({ amount = 0, baseDamage = 0, rating = 0, modifier = 0 } = {}) {
  amount = Math.max(0, Number(amount) || 0);
  baseDamage = Math.max(0, Number(baseDamage) || 0);
  rating = Math.max(0, Number(rating) || 0);
  modifier = Number(modifier) || 0;
  const level = rating > 0 ? Math.max(0, rating + modifier) : 0;
  const passesPenetrationLimit = baseDamage > level - 2;
  const remaining = passesPenetrationLimit ? Math.max(0, amount - level) : 0;
  return {
    level,
    passesPenetrationLimit,
    penetrated: remaining > 0,
    damageDeflected: amount - remaining,
    remaining,
  };
}
