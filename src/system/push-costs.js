import { causesWeaponJam } from './weapon-jams.js';

export const SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const PUSH_COST_MODE_SETTING = 'pushCostMode';

export const PUSH_COST_MODES = Object.freeze({
  MANUAL: 'manual',
  BUTTON: 'button',
  AUTOMATIC: 'automatic',
});

const PHYSICAL_ATTRIBUTES = new Set(['str', 'agl']);
const MENTAL_ATTRIBUTES = new Set(['int', 'emp']);

/** Return the world's configured push-cost handling mode. */
export function getPushCostMode() {
  return game.settings.get(SYSTEM_ID, PUSH_COST_MODE_SETTING) || PUSH_COST_MODES.BUTTON;
}

/** Resolve a UUID without allowing a missing or stale document to interrupt a push. */
function resolveUuid(uuid) {
  if (!uuid) return null;
  try {
    // eslint-disable-next-line no-undef
    return fromUuidSync(uuid);
  }
  catch (_error) {
    return null;
  }
}

/** Resolve the Actor and Item associated with a task check. */
export function resolvePushCostDocuments(roll) {
  let actor = resolveUuid(roll.options.actorUuid);
  if (!actor && roll.options.tokenKey) {
    const [sceneId, tokenId] = roll.options.tokenKey.split('.');
    actor = game.scenes.get(sceneId)?.tokens.get(tokenId)?.actor ?? null;
  }
  actor ??= game.actors.get(roll.options.actorId) ?? null;

  let item = resolveUuid(roll.options.itemUuid);
  item ??= actor?.items.get(roll.options.itemId) ?? null;
  item ??= game.items.get(roll.options.itemId) ?? null;

  return { actor, item };
}

function isOwner(doc) {
  return Boolean(doc && (game.user.isGM || doc.isOwner));
}

function getTrack(doc, path) {
  const track = foundry.utils.getProperty(doc, path);
  if (!track || !Number.isFinite(Number(track.value))) return null;
  return {
    value: Number(track.value),
    max: Number.isFinite(Number(track.max)) ? Number(track.max) : null,
  };
}

function createCost({ key, type, amount, target, path, processed, appliedAmounts }) {
  amount = Math.max(0, Number(amount) || 0);
  const processedAmount = Math.min(amount, Math.max(0, Number(processed[key]) || 0));
  const track = target && path ? getTrack(target, path) : null;
  const remaining = Math.max(0, amount - processedAmount);
  return {
    key,
    type,
    label: `YZEGS.PushCosts.Types.${type}`,
    amount,
    processed: processedAmount,
    remaining,
    appliedAmount: Math.max(0, Number(appliedAmounts[key]) || 0),
    applied: amount > 0 && remaining === 0,
    canApply: remaining > 0 && Boolean(track) && isOwner(target),
    targetUuid: target?.uuid ?? '',
    targetName: target?.name ?? '',
    current: track?.value ?? null,
    max: track?.max ?? null,
  };
}

/**
 * Calculate the Twilight: 2000 4e cost of the current pushed roll.
 *
 * Base-die banes cause Damage on STR/AGL rolls or Stress on INT/EMP rolls.
 * When a reliable tool or weapon is used for a physical roll, it takes those
 * banes instead. Ammo-die banes always affect the linked weapon's Reliability.
 */
export function prepareRollPushCosts(roll, { flags = {}, actor = null, item = null } = {}) {
  const mode = getPushCostMode();
  const processed = {
    reliability: Math.abs(Number(flags.reliabilityChange) || 0),
    ...(flags.pushCostsProcessed ?? {}),
  };
  const appliedAmounts = flags.pushCostChanges ?? {};
  const costs = [];

  if (roll.pushed) {
    const attribute = String(roll.options.attributeName ?? '').toLowerCase();
    const baseBanes = roll.attributeTrauma;
    const ammoBanes = roll.count('ammo', 1);
    const reliableItem = item?.hasReliability ? item : null;

    if (PHYSICAL_ATTRIBUTES.has(attribute)) {
      if (reliableItem) {
        costs.push(createCost({
          key: 'reliability', type: 'reliability', amount: baseBanes + ammoBanes,
          target: reliableItem, path: 'system.reliability', processed, appliedAmounts,
        }));
      }
      else {
        costs.push(createCost({
          key: 'damage', type: 'damage', amount: baseBanes,
          target: actor, path: 'system.health', processed, appliedAmounts,
        }));
        if (ammoBanes) {
          costs.push(createCost({
            key: 'reliability', type: 'reliability', amount: ammoBanes,
            target: null, path: null, processed, appliedAmounts,
          }));
        }
      }
    }
    else if (MENTAL_ATTRIBUTES.has(attribute)) {
      costs.push(createCost({
        key: 'stress', type: 'stress', amount: baseBanes,
        target: actor, path: 'system.sanity', processed, appliedAmounts,
      }));
      if (ammoBanes) {
        costs.push(createCost({
          key: 'reliability', type: 'reliability', amount: ammoBanes,
          target: reliableItem, path: 'system.reliability', processed, appliedAmounts,
        }));
      }
    }
    else {
      costs.push(createCost({
        key: 'damageOrStress', type: 'damageOrStress', amount: baseBanes,
        target: null, path: null, processed, appliedAmounts,
      }));
      if (ammoBanes) {
        costs.push(createCost({
          key: 'reliability', type: 'reliability', amount: ammoBanes,
          target: reliableItem, path: 'system.reliability', processed, appliedAmounts,
        }));
      }
    }
  }

  roll.options.pushCostMode = mode;
  roll.options.pushCosts = costs.filter(cost => cost.amount > 0);
  if (mode === PUSH_COST_MODES.MANUAL) {
    for (const cost of roll.options.pushCosts) cost.canApply = false;
  }
  roll.options.hasPushCosts = roll.options.pushCosts.length > 0;
  roll.options.canApplyPushCosts = mode === PUSH_COST_MODES.BUTTON
    && roll.options.pushCosts.some(cost => cost.canApply);
  roll.options.weaponJammed = causesWeaponJam(roll, item);
  return roll.options.pushCosts;
}

/** Persist a qualifying pushed attack's jam state independently of push-cost handling mode. */
export async function applyWeaponJam(roll, item) {
  if (!causesWeaponJam(roll, item)) return false;
  roll.options.weaponJammed = true;
  if (item.system.jammed || !isOwner(item)) return false;
  await item.update({ 'system.jammed': true });
  return true;
}

function getCostTarget(cost, actor, item) {
  const target = resolveUuid(cost.targetUuid);
  if (target) return target;
  if (cost.type === 'reliability') return item;
  return actor;
}

function getCostPath(type) {
  if (type === 'damage') return 'system.health.value';
  if (type === 'stress') return 'system.sanity.value';
  if (type === 'reliability') return 'system.reliability.value';
  return null;
}

/** Apply any as-yet unprocessed costs represented by a pushed roll. */
export async function applyRollPushCosts(roll, { flags = {}, actor = null, item = null } = {}) {
  prepareRollPushCosts(roll, { flags, actor, item });

  const processed = { ...(flags.pushCostsProcessed ?? {}) };
  const appliedAmounts = { ...(flags.pushCostChanges ?? {}) };
  const depleted = [];
  let applied = false;

  for (const cost of roll.options.pushCosts) {
    if (!cost.canApply || cost.remaining <= 0) continue;

    const target = getCostTarget(cost, actor, item);
    const path = getCostPath(cost.type);
    if (!target || !path) continue;
    const oldValue = Number(foundry.utils.getProperty(target, path));
    if (!Number.isFinite(oldValue)) continue;

    const newValue = Math.max(0, oldValue - cost.remaining);
    await target.update({ [path]: newValue });

    const actualChange = oldValue - newValue;
    processed[cost.key] = cost.amount;
    appliedAmounts[cost.key] = (Number(appliedAmounts[cost.key]) || 0) + actualChange;
    applied = true;
    if (oldValue > 0 && newValue === 0) depleted.push({ type: cost.type, name: target.name });
  }

  const updatedFlags = {
    ...flags,
    pushCostsProcessed: processed,
    pushCostChanges: appliedAmounts,
  };
  prepareRollPushCosts(roll, { flags: updatedFlags, actor, item });

  for (const entry of depleted) {
    const key = entry.type === 'reliability'
      ? 'YZEGS.PushCosts.Notifications.Broken'
      : 'YZEGS.PushCosts.Notifications.Incapacitated';
    ui.notifications.warn(game.i18n.format(key, { name: entry.name }));
  }

  return { applied, flags: updatedFlags };
}
