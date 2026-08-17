export const LAND_VEHICLE_COMPONENT_TABLE = Object.freeze({
  penetration: Object.freeze([
    'fuel', 'engine', 'suspension', 'ammunition', 'cargo',
    'driver', 'passenger', 'gunner', 'commander', 'radio',
  ]),
  noPenetration: Object.freeze([
    'trackWheel', 'weapon', 'fcs', 'antenna', 'externalStores',
    'externalStores', 'exposedPassenger', 'exposedPassenger', 'ricochet', 'ricochet',
  ]),
});

export const CALLED_VEHICLE_COMPONENTS = Object.freeze([
  'trackWheel', 'weapon', 'fcs', 'antenna', 'externalStores', 'exposedPassenger',
]);

export function getLandVehicleComponent(result, penetrated) {
  const index = Math.min(10, Math.max(1, Math.trunc(Number(result) || 1))) - 1;
  return penetrated
    ? LAND_VEHICLE_COMPONENT_TABLE.penetration[index]
    : LAND_VEHICLE_COMPONENT_TABLE.noPenetration[index];
}

export function getLandVehicleComponentRow(component, penetrated) {
  const table = penetrated
    ? LAND_VEHICLE_COMPONENT_TABLE.penetration
    : LAND_VEHICLE_COMPONENT_TABLE.noPenetration;
  return table.indexOf(component) + 1;
}

export function nextPenetratingComponentRow(row) {
  return Math.max(0, Math.trunc(Number(row) || 0) - 1);
}

export function trackWheelDamage(damage, sideArmor, armorModifier = 0) {
  const protection = Math.max(0, Math.ceil((Number(sideArmor) || 0) / 2) + (Number(armorModifier) || 0));
  return Math.max(0, (Number(damage) || 0) - protection);
}

export function armoredWeaponDamage(damage, frontArmor, armorModifier = 0, armored = false) {
  if (!armored) return Math.max(0, Number(damage) || 0);
  const protection = Math.max(0, Math.ceil((Number(frontArmor) || 0) / 2) + (Number(armorModifier) || 0));
  return Math.max(0, (Number(damage) || 0) - protection);
}

export function ammunitionRemainingFraction(damage) {
  damage = Math.max(0, Number(damage) || 0);
  if (damage >= 2) return 0;
  if (damage >= 1) return 0.5;
  return 1;
}

export function ammunitionExplosionChance(damage) {
  damage = Math.max(0, Number(damage) || 0);
  if (damage >= 2) return 1;
  if (damage >= 1) return 0.5;
  return 0;
}

export function increaseBlastRating(rating) {
  const ratings = ['–', 'D', 'C', 'B', 'A'];
  const index = ratings.indexOf(String(rating ?? '–').toLocaleUpperCase());
  return index < 0 ? '–' : ratings[Math.min(ratings.length - 1, index + 1)];
}
