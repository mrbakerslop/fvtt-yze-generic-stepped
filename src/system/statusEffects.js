/**
 * Registers Status Effect Icons.
 * @see https://foundryvtt.wiki/en/development/guides/active-effects
 */
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
      img: 'icons/svg/brick-wall.svg',
    },
    {
      id: 'engaged',
      name: 'EFFECT.StatusEngaged',
      img: 'icons/svg/swords.svg',
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
