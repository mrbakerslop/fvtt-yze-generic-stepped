import { isCompatibleWeaponAmmunition, weaponUsesInternalMagazine } from './ammunition-compatibility.js';
import { isMachineGun, usesHeavyWeaponRules } from './heavy-weapons.js';

export const INTERNAL_RELOAD_MODE_SETTING = 'internalMagazineReloadMode';

export const INTERNAL_RELOAD_MODES = Object.freeze({
  FULL: 'full',
  PER_ROUND: 'perRound',
});

const asCount = value => Math.max(0, Math.trunc(Number(value) || 0));

/** Whether an Actor is participating in the currently started Combat encounter. */
export function isActorInActiveCombat(actor, combat = null) {
  if (!actor || !combat) return false;
  const started = typeof combat.started === 'boolean'
    ? combat.started
    : Number(combat.round) > 0;
  if (!started) return false;
  return [...(combat.combatants ?? [])].some(combatant => (
    combatant.actor === actor
    || combatant.actor?.uuid === actor.uuid
    || combatant.actor?.id === actor.id
  ));
}

/** Resolve the action cost and completion state for a reload attempt. */
export function resolveReloadAction({
  inCombat = false,
  heavyWeapon = false,
  success = false,
  fast = 0,
  slow = 0,
} = {}) {
  fast = asCount(fast);
  slow = asCount(slow);
  if (!inCombat) {
    return { complete: true, action: null, spentFrom: null, forfeited: false, unavailable: false };
  }

  if (heavyWeapon) {
    if (slow > 0) {
      return { complete: true, action: 'slow', spentFrom: 'slow', forfeited: false, unavailable: false };
    }
    return { complete: false, action: null, spentFrom: null, forfeited: false, unavailable: true };
  }

  if (success) {
    if (fast > 0) {
      return { complete: true, action: 'fast', spentFrom: 'fast', forfeited: false, unavailable: false };
    }
    if (slow > 0) {
      return { complete: true, action: 'fast', spentFrom: 'slow', forfeited: false, unavailable: false };
    }
    return { complete: false, action: null, spentFrom: null, forfeited: false, unavailable: true };
  }

  if (slow > 0) {
    return { complete: true, action: 'slow', spentFrom: 'slow', forfeited: false, unavailable: false };
  }
  if (fast > 0) {
    return { complete: false, action: 'fast', spentFrom: 'fast', forfeited: true, unavailable: false };
  }
  return { complete: false, action: null, spentFrom: null, forfeited: false, unavailable: true };
}

/** Calculate how many loose rounds an internal-magazine reload will load. */
export function getInternalReloadAmount({ loaded = 0, capacity = 0, available = 0, perRound = false } = {}) {
  const missing = Math.max(0, asCount(capacity) - asCount(loaded));
  const usable = Math.min(missing, asCount(available));
  return perRound ? Math.min(1, usable) : usable;
}

/** Whether a weapon follows the heavy-weapon reload rule. */
export function isHeavyWeapon(weapon, skill = null) {
  if (weapon?.type !== 'weapon') return false;
  if (usesHeavyWeaponRules(weapon)) return true;
  if (isMachineGun(weapon.system?.itemType)) return false;
  const legacyKey = skill?.getFlag?.('fvtt-yze-generic-stepped', 'legacySkillKey');
  if (legacyKey === 'heavyWeapons') return true;
  return String(skill?.name ?? '').trim().toLocaleLowerCase() === 'heavy weapons';
}

/** Return compatible ammunition which still has something available to load. */
export function getReloadSources(weapon) {
  const actor = weapon?.actor;
  if (!actor) return [];
  const internal = weaponUsesInternalMagazine(weapon);
  return actor.itemTypes.ammunition.filter(ammunition => {
    if (!isCompatibleWeaponAmmunition(weapon, ammunition)) return false;
    if (internal) {
      if (asCount(ammunition.system.qty) <= 0) return false;
      const loaded = asCount(weapon.system.mag.value);
      const capacity = asCount(weapon.system.mag.max);
      if (loaded >= capacity && ammunition.id === weapon.system.mag.target) return false;
      return true;
    }
    if (ammunition.id === weapon.system.mag.target) return false;
    return asCount(ammunition.system.ammo?.value) > 0;
  });
}

/** Return the automatic modifier granted to a reload roll. */
export function getReloadModifier(actor) {
  if (!actor) return 0;
  const configured = actor.getRollModifiers?.()
    .filter(modifier => modifier.category === 'action' && modifier.target === 'reload')
    .reduce((total, modifier) => total + (Number(modifier.value) || 0), 0) ?? 0;
  if (configured) return configured;
  return actor.itemTypes?.specialty?.some(item => (
    ['reload', 'reloader'].includes(String(item.name).trim().toLocaleLowerCase())
  )) ? 1 : 0;
}

/** Resolve a legacy-keyed Skill Item, with an English-name fallback for unmigrated worlds. */
export function getReloadSkill(actor, legacyKey, fallbackName) {
  return actor?.getSkill?.(legacyKey)
    ?? actor?.itemTypes?.skill?.find(skill => (
      String(skill.name).trim().toLocaleLowerCase() === fallbackName.toLocaleLowerCase()
    ))
    ?? null;
}
