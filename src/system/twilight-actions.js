import { closeQuartersCombatEnabled, urbanCombatEnabled } from './urban-operations.js';
import { isArtilleryWeapon } from './heavy-weapons.js';

/**
 * Canonical Twilight: 2000 4e combat actions.
 *
 * `workflow` identifies the small amount of Foundry automation attached to an
 * action. Actions without a workflow still spend the correct action and make
 * the listed skill roll, leaving terrain and narrative results to the Referee.
 */
const defineAction = (id, speed, skill = '', options = {}) => Object.freeze({
  id,
  speed,
  skill,
  label: `YZEGS.ActionNames.${id}`,
  category: options.category ?? 'general',
  target: options.target ?? 'none',
  item: options.item ?? 'none',
  workflow: options.workflow ?? '',
  reactive: options.reactive ?? false,
  launcher: options.launcher ?? true,
  urbanOnly: options.urbanOnly ?? false,
  closeQuartersOnly: options.closeQuartersOnly ?? false,
  closeQuartersExcluded: options.closeQuartersExcluded ?? false,
  combatAllowed: options.combatAllowed ?? true,
  duration: options.duration ?? '',
  modifier: Number(options.modifier) || 0,
  modifierTargets: Object.freeze([id, ...(options.modifierTargets ?? [])]),
  hint: options.hint ? `YZEGS.CombatActions.Hints.${options.hint}` : '',
});

export const TWILIGHT_ACTIONS = Object.freeze([
  // Slow actions — Players' Manual, page 56.
  defineAction('getItemFromBackpack', 'slow', 'mobility', {
    category: 'inventory', item: 'backpack', workflow: 'retrieveItem',
  }),
  defineAction('persuade', 'slow', 'persuasion', {
    category: 'social', target: 'other', workflow: 'socialConflict',
  }),
  defineAction('interrogate', 'slow', 'persuasion', {
    category: 'social', target: 'other', workflow: 'socialConflict',
  }),
  defineAction('barter', 'slow', 'persuasion', {
    category: 'social', target: 'other', workflow: 'socialConflict',
  }),
  defineAction('unarmedAttack', 'slow', 'closeCombat', { category: 'close', target: 'other' }),
  defineAction('divingBlow', 'slow', 'closeCombat', {
    category: 'close', target: 'other', workflow: 'divingBlow', modifier: 2,
  }),
  defineAction('meleeAttack', 'slow', 'closeCombat', {
    category: 'close', target: 'other', item: 'meleeWeapon', workflow: 'attack',
  }),
  defineAction('grapple', 'slow', 'closeCombat', { category: 'close', target: 'other', workflow: 'grapple' }),
  defineAction('breakFree', 'slow', 'closeCombat', { category: 'close', workflow: 'breakFree' }),
  defineAction('shootFirearm', 'slow', 'rangedCombat', {
    category: 'ranged', target: 'optional', item: 'firearm', workflow: 'attack',
  }),
  defineAction('clearJam', 'slow', 'weaponSkill', { category: 'ranged', item: 'jammedWeapon', workflow: 'clearJam' }),
  defineAction('aimSniper', 'slow', '', {
    category: 'ranged', target: 'optional', item: 'scopedWeapon', workflow: 'aim',
  }),
  defineAction('shootBow', 'slow', 'rangedCombat', {
    category: 'ranged', target: 'optional', item: 'bowOrCrossbow', workflow: 'attack',
  }),
  defineAction('throwWeapon', 'slow', 'mobility', {
    category: 'ranged', target: 'optional', item: 'thrownWeapon', workflow: 'attack',
  }),
  defineAction('aimMortar', 'slow', '', { category: 'heavy', item: 'artillery', workflow: 'aim' }),
  defineAction('shootHeavyWeapon', 'slow', 'heavyWeapons', {
    category: 'heavy', target: 'optional', item: 'heavyWeapon', workflow: 'attack',
  }),
  defineAction('directFire', 'slow', 'recon', {
    category: 'heavy', target: 'other', workflow: 'directIndirectFire',
  }),
  defineAction('firstAid', 'slow', 'medicalAid', {
    category: 'support', target: 'other', item: 'medicalGearOptional', workflow: 'firstAid',
  }),
  defineAction('rally', 'slow', 'command', { category: 'support', target: 'other', workflow: 'rally' }),
  defineAction('killingBlow', 'slow', '', { category: 'close', target: 'other', workflow: 'killingBlow' }),
  defineAction('enterExitVehicle', 'slow', '', { category: 'vehicle', target: 'vehicle' }),

  // Fast actions — Players' Manual, page 56.
  defineAction('dropBackpack', 'fast', '', { category: 'inventory', workflow: 'dropBackpack' }),
  defineAction('seekPartialCover', 'fast', '', {
    category: 'movement', target: 'optional', workflow: 'partialCover', modifierTargets: ['seekCover'],
  }),
  defineAction('seekFullCover', 'fast', '', {
    category: 'movement', target: 'optional', workflow: 'fullCover', modifierTargets: ['seekCover'],
  }),
  defineAction('fullToPartialCover', 'fast', '', { category: 'movement', workflow: 'partialCover' }),
  defineAction('run', 'fast', 'mobility', { category: 'movement' }),
  defineAction('crossLowBarrier', 'fast', 'mobility', { category: 'movement' }),
  defineAction('moveThroughDoor', 'fast', '', { category: 'movement' }),
  defineAction('crawl', 'fast', 'mobility', { category: 'movement' }),
  defineAction('getUp', 'fast', '', { category: 'movement', workflow: 'stand' }),
  defineAction('drawItem', 'fast', '', { category: 'inventory', item: 'combatGear', workflow: 'drawItem' }),
  defineAction('shove', 'fast', 'closeCombat', { category: 'close', target: 'other', workflow: 'shove' }),
  defineAction('disarm', 'fast', 'closeCombat', { category: 'close', target: 'other', workflow: 'disarm' }),
  defineAction('grappleAttack', 'fast', 'closeCombat', {
    category: 'close', target: 'other', workflow: 'grappleAttack',
  }),
  defineAction('retreat', 'fast', 'mobility', {
    category: 'movement', target: 'other', workflow: 'retreat',
  }),
  defineAction('aim', 'fast', '', {
    category: 'ranged', target: 'optional', item: 'rangedWeapon', workflow: 'aim',
  }),
  defineAction('prepareBow', 'fast', '', { category: 'ranged', item: 'bow', workflow: 'prepareBow' }),
  defineAction('overwatch', 'fast', '', {
    category: 'ranged', target: 'optional', item: 'rangedWeapon', workflow: 'overwatch',
  }),
  defineAction('overwatchAperture', 'fast', '', {
    category: 'urban', item: 'rangedWeapon', workflow: 'overwatch', urbanOnly: true,
    hint: 'overwatchAperture',
  }),
  defineAction('seekVehicleCover', 'fast', '', {
    category: 'urban', target: 'vehicle', workflow: 'vehicleCover', urbanOnly: true,
    hint: 'vehicleCover',
  }),
  defineAction('reload', 'fast', 'rangedCombat', { category: 'ranged', item: 'reloadableWeapon', workflow: 'reload' }),
  defineAction('pullGrenadePin', 'fast', '', { category: 'ranged', item: 'grenade', workflow: 'prepareGrenade' }),
  defineAction('getOnBike', 'fast', '', { category: 'vehicle', target: 'vehicle' }),
  defineAction('grabWheel', 'fast', '', { category: 'vehicle', target: 'vehicle' }),
  defineAction('startEngine', 'fast', '', { category: 'vehicle', target: 'vehicle' }),
  defineAction('drive', 'fast', 'driving', { category: 'vehicle', target: 'vehicle' }),
  defineAction('useItem', 'fast', '', { category: 'general', item: 'any' }),

  // Free actions — Players' Manual, page 57.
  defineAction('dropProne', 'free', '', { category: 'movement', workflow: 'prone' }),
  defineAction('dropHeldItem', 'free', '', { category: 'inventory', item: 'equipped', workflow: 'dropItem' }),
  defineAction('partialToFullCover', 'free', '', { category: 'movement', workflow: 'fullCover' }),
  defineAction('shout', 'free', '', { category: 'general' }),
  defineAction('moveWounded', 'free', 'medicalAid', {
    category: 'support', target: 'other', workflow: 'moveWounded', reactive: true,
  }),

  // Explicit variants and special combat actions described later in the chapter.
  defineAction('crossHighBarrier', 'slow', 'mobility', { category: 'movement' }),
  defineAction('retrieveArrowFromVictim', 'slow', 'medicalAid', { category: 'support', target: 'other' }),
  defineAction('retrieveArrowFromGround', 'fast', '', { category: 'inventory' }),
  defineAction('extinguishFire', 'slow', 'mobility', {
    category: 'support', target: 'optional', workflow: 'extinguishFire',
  }),
  defineAction('putOnMask', 'fast', '', {
    category: 'inventory', item: 'protectiveMask', workflow: 'putOnMask',
  }),
  defineAction('injectAtropine', 'fast', '', {
    category: 'support', target: 'optional', item: 'atropine', workflow: 'injectAtropine',
  }),
  defineAction('getVehicleUnstuck', 'slow', 'driving', { category: 'vehicle', target: 'vehicle' }),
  defineAction('bailOut', 'slow', '', { category: 'vehicle', target: 'vehicle', workflow: 'bailOut' }),
  defineAction('takeDriverControl', 'fast', '', { category: 'vehicle', target: 'vehicle' }),
  defineAction('fireSmokeLauncher', 'slow', '', { category: 'vehicle', target: 'vehicle' }),
  defineAction('correctIndirectFire', 'slow', '', {
    category: 'heavy', target: 'other', workflow: 'correctIndirectFire',
  }),
  defineAction('guideMissile', 'slow', 'heavyWeapons', { category: 'heavy', target: 'other', item: 'heavyWeapon' }),
  defineAction('block', 'fast', 'closeCombat', {
    category: 'close', target: 'other', reactive: true, launcher: false,
  }),
  defineAction('helpFast', 'fast', '', { category: 'support', target: 'other', reactive: true }),
  defineAction('helpSlow', 'slow', '', { category: 'support', target: 'other', reactive: true }),
  defineAction('retreatFreeAttack', 'free', 'closeCombat', {
    category: 'close', target: 'other', item: 'meleeWeapon', workflow: 'attack', reactive: true,
  }),
  defineAction('diveFromGrenade', 'free', 'mobility', {
    category: 'movement', workflow: 'diveFromGrenade', reactive: true, hint: 'diveFromGrenade',
  }),
  defineAction('overwatchContest', 'free', 'rangedCombat', {
    category: 'ranged', target: 'other', reactive: true,
  }),

  // Urban Operations actions. Close-quarters entries are shown only on a
  // Close Quarters Scene; stretch/shift tasks cannot be started during combat.
  defineAction('spotShooter', 'free', 'recon', {
    category: 'urban', target: 'other', urbanOnly: true, hint: 'spotShooter', modifier: 2,
  }),
  defineAction('spotSilentShooter', 'free', 'recon', {
    category: 'urban', target: 'other', urbanOnly: true, hint: 'spotSilentShooter',
  }),
  defineAction('blindFire', 'slow', 'rangedCombat', {
    category: 'urban', urbanOnly: true, launcher: false, workflow: 'attack', hint: 'blindFire',
  }),
  defineAction('hugWall', 'fast', '', {
    category: 'urban', urbanOnly: true, closeQuartersExcluded: true, workflow: 'hugWall', hint: 'hugWall',
  }),
  defineAction('enterBuilding', 'fast', '', {
    category: 'urban', urbanOnly: true, closeQuartersExcluded: true, hint: 'enterBuilding',
  }),
  defineAction('moveSector', 'fast', '', {
    category: 'urban', closeQuartersOnly: true, hint: 'moveSector',
  }),
  defineAction('moveIndoorHex', 'fast', '', {
    category: 'urban', urbanOnly: true, closeQuartersExcluded: true, hint: 'moveIndoorHex',
  }),
  defineAction('changeFloor', 'fast', '', {
    category: 'urban', urbanOnly: true, hint: 'changeFloor',
  }),
  defineAction('climbFloor', 'slow', 'mobility', {
    category: 'urban', closeQuartersOnly: true, hint: 'climbFloor',
  }),
  defineAction('breachWallStamina', 'extended', 'stamina', {
    category: 'urban', urbanOnly: true, closeQuartersExcluded: true,
    combatAllowed: false, duration: 'shift', hint: 'breachWall',
  }),
  defineAction('breachWallTech', 'extended', 'tech', {
    category: 'urban', urbanOnly: true, closeQuartersExcluded: true,
    combatAllowed: false, duration: 'shift', hint: 'breachWall',
  }),
  defineAction('breachApertureStamina', 'extended', 'stamina', {
    category: 'urban', closeQuartersOnly: true,
    combatAllowed: false, duration: 'stretch', hint: 'breachAperture',
  }),
  defineAction('breachApertureTech', 'extended', 'tech', {
    category: 'urban', closeQuartersOnly: true,
    combatAllowed: false, duration: 'stretch', hint: 'breachAperture',
  }),
  defineAction('blockAperture', 'extended', '', {
    category: 'urban', closeQuartersOnly: true,
    combatAllowed: false, duration: 'stretch', hint: 'blockAperture',
  }),
  defineAction('blockIndoorHex', 'extended', '', {
    category: 'urban', urbanOnly: true, closeQuartersExcluded: true,
    combatAllowed: false, duration: 'shift', hint: 'blockIndoorHex',
  }),
  defineAction('calmCrowd', 'slow', 'command', {
    category: 'urban', target: 'optional', hint: 'calmCrowd',
  }),
  defineAction('monitorRadio', 'extended', '', {
    category: 'urban', combatAllowed: false, duration: 'shift', hint: 'monitorRadio',
  }),
  defineAction('searchBoobyTrap', 'free', 'recon', {
    category: 'urban', urbanOnly: true, reactive: true, hint: 'searchBoobyTrap',
  }),
  defineAction('placeBoobyTrap', 'extended', 'tech', {
    category: 'urban', urbanOnly: true, combatAllowed: false, duration: 'stretch', hint: 'placeBoobyTrap',
  }),
  defineAction('placeUrbanObstacle', 'extended', '', {
    category: 'urban', urbanOnly: true, closeQuartersExcluded: true,
    combatAllowed: false, duration: 'shift', hint: 'placeUrbanObstacle',
  }),

  // Generic minefield and collapse actions.
  defineAction('detectMines', 'free', 'recon', {
    category: 'hazards', reactive: true, hint: 'detectMines',
  }),
  defineAction('cautiousMineMovement', 'fast', 'recon', {
    category: 'hazards', hint: 'cautiousMineMovement',
  }),
  defineAction('probeMines', 'extended', 'recon', {
    category: 'hazards', combatAllowed: false, duration: 'stretch', modifier: 2, hint: 'probeMines',
  }),
  defineAction('placeMines', 'extended', 'tech', {
    category: 'hazards', item: 'mine', combatAllowed: false, duration: 'stretch', hint: 'placeMines',
  }),
  defineAction('clearMines', 'extended', 'tech', {
    category: 'hazards', combatAllowed: false, duration: 'stretch', hint: 'clearMines',
  }),
  defineAction('breakFreeDebris', 'slow', 'stamina', {
    category: 'hazards', workflow: 'breakFreeDebris', hint: 'breakFreeDebris',
  }),

  // Generic water actions.
  defineAction('swim', 'fast', 'mobility', {
    category: 'water', workflow: 'swim', hint: 'swim',
  }),
  defineAction('stayAfloat', 'free', 'mobility', {
    category: 'water', workflow: 'stayAfloat', reactive: true, hint: 'stayAfloat',
  }),
  defineAction('submerge', 'free', '', { category: 'water', workflow: 'submerge' }),
  defineAction('surface', 'free', '', { category: 'water', workflow: 'surface' }),
  defineAction('climbAboard', 'fast', 'mobility', {
    category: 'water', target: 'vehicle', workflow: 'climbAboard', hint: 'climbAboard',
  }),
  defineAction('rescueDrowning', 'slow', 'medicalAid', {
    category: 'water', target: 'other', workflow: 'rescueDrowning', hint: 'rescueDrowning',
  }),
  defineAction('turnLargeVessel', 'slow', '', {
    category: 'water', target: 'vehicle', workflow: 'turnLargeVessel', hint: 'turnLargeVessel',
  }),
  defineAction('freeVessel', 'extended', 'driving', {
    category: 'water', target: 'vehicle', combatAllowed: false, duration: 'stretch', hint: 'freeVessel',
  }),
  defineAction('repairHull', 'extended', 'tech', {
    category: 'water', target: 'vehicle', combatAllowed: false, duration: 'shift', hint: 'repairHull',
  }),
  defineAction('bailWater', 'extended', 'stamina', {
    category: 'water', target: 'vehicle', combatAllowed: false, duration: 'stretch', hint: 'bailWater',
  }),
  defineAction('ramVessel', 'fast', 'driving', {
    category: 'water', target: 'vehicle', workflow: 'ramVessel', hint: 'ramVessel',
  }),
  defineAction('evadeGuidedWeapon', 'slow', 'driving', {
    category: 'water', target: 'vehicle', reactive: true, launcher: false,
    hint: 'evadeGuidedWeapon', modifier: -3,
  }),
]);

export const TWILIGHT_ACTION_MAP = new Map(TWILIGHT_ACTIONS.map(action => [action.id, action]));

export function getTwilightAction(actionId) {
  return TWILIGHT_ACTION_MAP.get(actionId) ?? null;
}

export function getTwilightActionGroups(actions = TWILIGHT_ACTIONS) {
  return ['slow', 'fast', 'free', 'extended'].map(speed => ({
    speed,
    actions: actions.filter(action => action.speed === speed),
  }));
}

/** Actions which can be meaningfully launched from an ordinary Skill test dialog. */
export function getTwilightSkillRollActions(skillKey) {
  const dedicatedWorkflows = new Set(['attack', 'clearJam', 'reload']);
  return TWILIGHT_ACTIONS.filter(action => (
    action.skill === skillKey
    && action.launcher
    && (!action.urbanOnly || urbanCombatEnabled())
    && (!action.closeQuartersOnly || closeQuartersCombatEnabled())
    && (!action.closeQuartersExcluded || !closeQuartersCombatEnabled())
    && !dedicatedWorkflows.has(action.workflow)
  ));
}

export function actionNeedsTarget(action) {
  return ['other', 'optional', 'vehicle'].includes(action?.target);
}

export function actionNeedsItem(action) {
  return Boolean(action && action.item !== 'none' && !action.item.endsWith('Optional'));
}

/** Pure item filtering shared by the launcher and tests. */
export function itemMatchesAction(item, action) {
  if (!item || !action || action.item === 'none') return false;
  const system = item.system ?? {};
  const itemType = String(system.itemType ?? '').toLocaleLowerCase();
  const heavy = Boolean(system.props?.heavyWeapon);
  switch (action.item) {
    case 'any': return ['weapon', 'armor', 'grenade', 'ammunition', 'gear'].includes(item.type);
    case 'backpack': return Boolean(system.backpack);
    case 'combatGear':
      return !system.backpack && ['weapon', 'armor', 'grenade', 'ammunition', 'gear'].includes(item.type);
    case 'equipped': return Boolean(system.equipped) && ['weapon', 'gear', 'grenade'].includes(item.type);
    case 'meleeWeapon': return item.type === 'weapon' && !system.ammo;
    case 'firearm': return item.type === 'weapon' && Boolean(system.ammo) && !heavy;
    case 'rangedWeapon': return item.type === 'weapon' && !/mortar|howitzer/.test(itemType);
    case 'scopedWeapon': return item.type === 'weapon' && Boolean(system.props?.scope);
    case 'bow': return item.type === 'weapon' && /bow/.test(itemType) && !/crossbow/.test(itemType);
    case 'bowOrCrossbow': return item.type === 'weapon' && /bow|crossbow/.test(itemType);
    case 'thrownWeapon': return item.type === 'grenade' || (item.type === 'weapon' && /throw/.test(itemType));
    case 'artillery': return isArtilleryWeapon(item);
    case 'heavyWeapon': return item.type === 'weapon' && heavy;
    case 'jammedWeapon': return item.type === 'weapon' && Boolean(system.jammed);
    case 'reloadableWeapon': return item.type === 'weapon' && Boolean(system.ammo);
    case 'grenade': return item.type === 'grenade';
    case 'mine': return item.type === 'grenade' && item.system.explosiveType !== 'grenade';
    case 'medicalGearOptional':
      return item.type === 'gear' && /medical|medkit|surgical|first aid/.test(`${item.name} ${itemType}`.toLowerCase());
    case 'protectiveMask': return item.type === 'gear' && system.chemicalProtection === 'mask';
    case 'atropine': return item.type === 'gear' && system.medicalTreatment === 'atropine';
    default: return false;
  }
}
