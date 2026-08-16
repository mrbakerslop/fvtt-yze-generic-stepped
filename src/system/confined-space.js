import { increaseIndoorBlast } from './urban-operations.js';
export { CONFINED_SPACE_FLAG, isConfinedSpaceScene } from './scene-grid.js';

export function isRicochetEligibleWeapon(item = {}) {
  const system = item.system ?? item;
  const itemType = String(system.itemType ?? '').trim().toLocaleLowerCase();
  if (!system.ammo || system.props?.shotgun || /shotgun/.test(itemType)) return false;
  if (system.blast && system.blast !== '–') return false;
  return !/bow|crossbow|launcher|mortar|howitzer/.test(itemType);
}

export function getRicochetShotCount(ammunitionSpent) {
  return Math.max(1, Math.trunc(Number(ammunitionSpent) || 1));
}

export function countRicochets(results = []) {
  return results.filter(result => Number(result) === 1).length;
}

export function getConfinedBlastRating(blast, confined = true) {
  return confined ? increaseIndoorBlast(blast) : blast;
}

export function getCollapseDieSize(blast) {
  return { A: 12, B: 10, C: 8, D: 6 }[String(blast ?? '').toLocaleUpperCase()] ?? 0;
}

export function collapseOccurs(successes) {
  return Math.max(0, Number(successes) || 0) >= 2;
}
