import {
  getTacticalTerrainProfile,
  tacticalMovementModifier,
  terrainProvidesCover,
} from './tactical-terrain-rules.js';

export const TACTICAL_TERRAIN_SETTING = 'tacticalTerrainAssistance';
const SYSTEM_ID = 'fvtt-yze-generic-stepped';
const TOKEN_FLAG = 'tacticalTerrain';

export function tacticalTerrainEnabled() {
  return Boolean(game.settings.get(SYSTEM_ID, TACTICAL_TERRAIN_SETTING));
}

function actorTokenDocument(actor) {
  const token = actor?.token?.object
    ?? actor?.getActiveTokens?.(true, true)?.find(entry => entry.scene?.id === canvas.scene?.id)
    ?? actor?.getActiveTokens?.(true, true)?.[0]
    ?? null;
  return token?.document ?? token ?? null;
}

export function getTokenTacticalTerrain(token) {
  if (!tacticalTerrainEnabled() || !token) return null;
  const entries = Object.values(token.getFlag?.(SYSTEM_ID, TOKEN_FLAG) ?? {});
  if (!entries.length) return null;
  return entries.sort((left, right) => Number(right.enteredAt) - Number(left.enteredAt))[0];
}

export function getActorTacticalTerrain(actor) {
  return getTokenTacticalTerrain(actorTokenDocument(actor));
}

export function getTacticalMovementData(actor, actionId) {
  if (!tacticalTerrainEnabled() || !['run', 'crawl'].includes(actionId)) return null;
  const terrain = getActorTacticalTerrain(actor) ?? {
    type: 'unmarked',
    label: game.i18n.localize('YZEGS.TacticalTerrain.Unmarked'),
    movement: 0,
    ranged: 0,
    coverArmor: 0,
    infiltration: 0,
    visibility: null,
  };
  const backpack = Number(actor.system.encumbrance?.backpack?.value) > 0
    && !actor.getFlag(SYSTEM_ID, 'actionBackpackDropped');
  return {
    actionId,
    terrain,
    backpack,
    modifier: tacticalMovementModifier(terrain, { backpack }),
  };
}

export function getTerrainCover(actor) {
  const terrain = getActorTacticalTerrain(actor);
  if (!terrain || !terrainProvidesCover(terrain)) return null;
  return { armor: terrain.coverArmor, label: terrain.label };
}

export function getTerrainRangedModifier(actor) {
  const terrain = getActorTacticalTerrain(actor);
  return terrain ? Number(terrain.ranged) || 0 : 0;
}

export function getTerrainInfiltrationModifier(actor) {
  const terrain = getActorTacticalTerrain(actor);
  return terrain ? Number(terrain.infiltration) || 0 : 0;
}

export function regionTerrainProfile(behavior) {
  const profile = getTacticalTerrainProfile(behavior.terrainType, {
    name: behavior.customName,
    movement: behavior.movementModifier,
    ranged: behavior.rangedModifier,
    coverArmor: behavior.coverArmor,
    infiltration: behavior.infiltrationModifier,
    visibility: behavior.visibility,
    forcedCrawl: behavior.forcedCrawl,
    blocking: behavior.blocking,
  });
  const label = profile.type === 'custom'
    ? (profile.name || game.i18n.localize('YZEGS.TacticalTerrain.Types.custom'))
    : game.i18n.localize(`YZEGS.TacticalTerrain.Types.${profile.type}`);
  return { ...profile, label, elevated: Boolean(behavior.elevated) };
}

export async function enterTacticalTerrain(token, behavior) {
  if (!tacticalTerrainEnabled() || !token) return;
  token = token.document ?? token;
  const entries = foundry.utils.deepClone(token.getFlag(SYSTEM_ID, TOKEN_FLAG) ?? {});
  const behaviorUuid = behavior.behavior?.uuid ?? behavior.uuid;
  entries[behaviorUuid] = { ...regionTerrainProfile(behavior), enteredAt: Date.now() };
  await token.setFlag(SYSTEM_ID, TOKEN_FLAG, entries);
  if (entries[behaviorUuid].blocking) {
    ui.notifications.warn(game.i18n.format('YZEGS.TacticalTerrain.BlockingWarning', {
      token: token.name,
      terrain: entries[behaviorUuid].label,
    }));
  }
}

export async function leaveTacticalTerrain(token, behavior) {
  if (!token) return;
  token = token.document ?? token;
  const entries = foundry.utils.deepClone(token.getFlag(SYSTEM_ID, TOKEN_FLAG) ?? {});
  const behaviorUuid = behavior.behavior?.uuid ?? behavior.uuid;
  if (!Object.hasOwn(entries, behaviorUuid)) return;
  delete entries[behaviorUuid];
  if (Object.keys(entries).length) await token.setFlag(SYSTEM_ID, TOKEN_FLAG, entries);
  else await token.unsetFlag(SYSTEM_ID, TOKEN_FLAG);
}
