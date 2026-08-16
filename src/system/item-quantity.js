/**
 * Whether an Item uses the generic stack quantity field.
 * Magazine and belt ammunition track rounds in ammo.value instead of representing a stack.
 * @param {string} type Item type
 * @param {object} system Item system data
 * @returns {boolean}
 */
export function usesItemQuantity(type, system) {
  if (type === 'ammunition' && system?.props?.ammoBox) return true;
  return type !== 'ammunition' || !(system?.props?.magazine || system?.props?.ammoBelt);
}
