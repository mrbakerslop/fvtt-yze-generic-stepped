const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export function getQuickShotModifier(item) {
  const type = String(item?.system?.itemType ?? '').toLocaleLowerCase();
  return /pistol|carbine|submachine|\bsmg\b/.test(type) ? -1 : -2;
}

export function getRangedPreparation(actor, item, targetUuids = []) {
  if (!actor || item?.type !== 'weapon') {
    return { aimed: false, blocked: false, modifier: 0, noAmmoDice: false };
  }
  const aim = actor.getFlag?.(SYSTEM_ID, 'actionAim') ?? {};
  const targetMatches = aim.targetUuid === '*'
    || (Boolean(aim.targetUuid) && targetUuids.includes(aim.targetUuid));
  const aimed = actor.statuses?.has?.('aiming') && aim.weaponUuid === item.uuid && targetMatches;
  const heavy = Boolean(item.system.props?.heavyWeapon);
  if (heavy && !aimed) return { aimed: false, blocked: true, modifier: 0, noAmmoDice: false };
  if (!aimed) {
    return { aimed: false, blocked: false, modifier: getQuickShotModifier(item), noAmmoDice: false };
  }
  const sniper = aim.mode === 'aimSniper';
  const stable = Boolean(actor.cover || actor.statuses?.has?.('prone') || item.system.props?.bipod);
  let modifier = 0;
  if (sniper) modifier = stable ? 2 : 1;
  return {
    aimed: true,
    blocked: false,
    modifier,
    noAmmoDice: sniper,
  };
}
