/** Build a hotbar command that prefers the original embedded Item id and can fall back by name. */
export function buildItemMacroCommand(item) {
  return `game.yzegs.macros.rollItem(${JSON.stringify(item.id)}, ${JSON.stringify(item.name)});`;
}

/** Resolve an Item macro against the currently active Actor. */
export function resolveActorMacroItem(actor, itemReference, fallbackName = null) {
  const itemName = fallbackName ?? itemReference;
  if (!actor) return { item: null, itemName, matches: [] };

  if (fallbackName) {
    const item = actor.items.get(itemReference);
    if (item) return { item, itemName, matches: [item] };
  }

  const matches = actor.items.filter(item => item.name === itemName);
  return {
    item: matches.length === 1 ? matches[0] : null,
    itemName,
    matches,
  };
}
