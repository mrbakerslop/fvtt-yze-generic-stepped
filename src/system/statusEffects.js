/**
 * Registers Status Effect Icons.
 * @see https://foundryvtt.wiki/en/development/guides/active-effects
 */
export const ENGAGED_STATUS_ICON = 'icons/svg/sword.svg';
export const HUGGING_WALL_STATUS_ICON = 'icons/svg/castle.svg';

const STATUS_ICON_REPAIRS = Object.freeze({
  engaged: {
    icon: ENGAGED_STATUS_ICON,
    legacyIcons: new Set(['icons/svg/swords.svg', 'icons/svg/sworlds.svg']),
  },
  huggingWall: {
    icon: HUGGING_WALL_STATUS_ICON,
    legacyIcons: new Set(['icons/svg/brick-wall.svg']),
  },
});

/** Return an embedded-document update for a system status with a broken legacy icon. */
export function getStatusIconUpdate(effect) {
  const icon = effect.img ?? effect.icon ?? '';
  for (const [statusId, repair] of Object.entries(STATUS_ICON_REPAIRS)) {
    if (effect?.statuses?.has?.(statusId) && repair.legacyIcons.has(icon)) {
      return { _id: effect.id, img: repair.icon };
    }
  }
  return null;
}

/** Repair existing world and synthetic-token status effects created with an invalid icon path. */
export async function repairStatusEffectIcons() {
  if (!game.user.isGM) return 0;

  const actors = new Map(game.actors.map(actor => [actor.uuid, actor]));
  for (const scene of game.scenes) {
    for (const token of scene.tokens) {
      if (token.actor) actors.set(token.actor.uuid, token.actor);
    }
  }

  let repaired = 0;
  for (const actor of actors.values()) {
    const updates = actor.effects.map(getStatusIconUpdate).filter(Boolean);
    if (!updates.length) continue;
    try {
      await actor.updateEmbeddedDocuments('ActiveEffect', updates);
      repaired += updates.length;
    }
    catch (error) {
      console.error(`YZEGS | Failed to repair status icons for ${actor.name}.`, error);
    }
  }
  return repaired;
}

export function registerStatusEffects() {
  const path = 'systems/fvtt-yze-generic-stepped/assets/icons/';
  CONFIG.statusEffects = [
    {
      id: 'fullCover',
      name: 'EFFECT.StatusFullCover',
      img: `${path}token_full_cover.webp`,
    },
    {
      id: 'partialCover',
      name: 'EFFECT.StatusPartialCover',
      img: `${path}token_partial_cover.webp`,
    },
    {
      id: 'overwatch',
      name: 'EFFECT.StatusOverwatch',
      img: `${path}token_overwatch.webp`,
    },
    {
      id: 'huggingWall',
      name: 'EFFECT.StatusHuggingWall',
      img: HUGGING_WALL_STATUS_ICON,
    },
    {
      id: 'engaged',
      name: 'EFFECT.StatusEngaged',
      img: ENGAGED_STATUS_ICON,
    },
    {
      id: 'aiming',
      name: 'EFFECT.StatusAiming',
      img: 'icons/svg/target.svg',
    },
    {
      id: 'suppressed',
      name: 'EFFECT.StatusSuppressed',
      img: `${path}token_suppressed.webp`,
    },
    {
      id: 'stop',
      name: 'EFFECT.StatusStop',
      img: `${path}token_stop.webp`,
    },
    {
      id: 'smoke',
      name: 'EFFECT.StatusSmoke',
      img: `${path}token_smoke.webp`,
    },
    {
      id: 'fire',
      name: 'EFFECT.StatusFire',
      img: `${path}token_fire.webp`,
    },
    {
      img: 'icons/svg/skull.svg',
      id: 'dead',
      name: 'EFFECT.StatusDead',
    },
    {
      img: 'icons/svg/unconscious.svg',
      id: 'incapacitatedDamage',
      name: 'EFFECT.StatusIncapacitatedDamage',
    },
    {
      img: 'icons/svg/terror.svg',
      id: 'incapacitatedStress',
      name: 'EFFECT.StatusIncapacitatedStress',
    },
    {
      img: 'icons/svg/paralysis.svg',
      id: 'immobile',
      name: 'EFFECT.StatusImmobile',
    },
    {
      img: 'icons/svg/sleep.svg',
      id: 'sleep',
      name: 'EFFECT.StatusAsleep',
    },
    {
      img: 'icons/svg/daze.svg',
      id: 'stun',
      name: 'EFFECT.StatusStunned',
    },
    {
      img: 'icons/svg/falling.svg',
      id: 'prone',
      name: 'EFFECT.StatusProne',
    },
    {
      img: 'icons/svg/net.svg',
      id: 'restrain',
      name: 'EFFECT.StatusRestrained',
    },
    {
      img: 'icons/svg/falling.svg',
      id: 'pinnedByDebris',
      name: 'EFFECT.StatusPinnedByDebris',
    },
    {
      img: 'icons/svg/falling.svg',
      id: 'swimming',
      name: 'EFFECT.StatusSwimming',
    },
    {
      img: 'icons/svg/falling.svg',
      id: 'submerged',
      name: 'EFFECT.StatusSubmerged',
    },
    {
      img: 'icons/svg/skull.svg',
      id: 'drowning',
      name: 'EFFECT.StatusDrowning',
    },
    {
      img: 'icons/svg/falling.svg',
      id: 'overboard',
      name: 'EFFECT.StatusOverboard',
    },
    {
      img: 'icons/svg/frozen.svg',
      id: 'hypothermia',
      name: 'EFFECT.StatusHypothermia',
    },
    {
      img: 'icons/svg/blind.svg',
      id: 'blind',
      name: 'EFFECT.StatusBlind',
    },
  ];
}
