import YZEGSDialog from '../components/dialog/dialog.js';
import { YZEGSRoller } from '../components/roll/dice.js';
import {
  closeQuartersCombatEnabled,
  getBlastDamageProfile,
  increaseIndoorBlast,
} from './urban-operations.js';
import { isConfinedSpaceScene } from './confined-space.js';
import {
  blastCanPenetrateCover,
  getBlastRadius,
  getEffectiveBlastRating,
  resolveDeviation,
} from './heavy-weapons.js';
import { measureCombatPointDistance } from './combat-edge-workflows.js';
import { getEnclosingVehicle } from './suppression.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

function localize(key, data = {}) {
  return Object.keys(data).length ? game.i18n.format(key, data) : game.i18n.localize(key);
}

export function snapshotCanvasPoint(point) {
  if (!point || !canvas.grid || !canvas.scene) return null;
  const offset = canvas.grid.getOffset(point);
  const center = canvas.grid.getCenterPoint(offset);
  return {
    sceneId: canvas.scene.id,
    x: Number(center.x) || 0,
    y: Number(center.y) || 0,
    i: Number(offset.i) || 0,
    j: Number(offset.j) || 0,
  };
}

/** Ask the user to click a grid space when an explosive attack targets a hex rather than a token. */
export async function pickExplosionTargetPoint() {
  if (!canvas?.ready || !canvas.stage || !canvas.grid) {
    ui.notifications.warn(localize('YZEGS.Heavy.Errors.CanvasRequired'));
    return null;
  }
  ui.notifications.info(localize('YZEGS.Heavy.TargetHexPrompt'));
  const view = canvas.app?.view;
  const priorCursor = view?.style?.cursor ?? '';
  if (view) view.style.cursor = 'crosshair';
  return new Promise(resolve => {
    const cleanup = () => {
      canvas.stage.off('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      if (view) view.style.cursor = priorCursor;
    };
    const finish = point => {
      cleanup();
      resolve(point);
    };
    const onPointerDown = event => {
      if (Number(event.button) !== 0) return;
      finish(snapshotCanvasPoint(event.getLocalPosition(canvas.stage)));
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') finish(null);
    };
    canvas.stage.on('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
  });
}

function angleDifference(left, right) {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

function deviationPoint(startPoint, direction, distance) {
  if (!startPoint || !canvas.grid || startPoint.sceneId !== canvas.scene?.id) return startPoint;
  const angles = {
    north: -Math.PI / 2,
    northEast: -Math.PI / 6,
    southEast: Math.PI / 6,
    south: Math.PI / 2,
    southWest: (5 * Math.PI) / 6,
    northWest: (-5 * Math.PI) / 6,
  };
  let offset = { i: startPoint.i, j: startPoint.j };
  for (let step = 0; step < distance; step++) {
    const center = canvas.grid.getCenterPoint(offset);
    const neighbors = canvas.grid.getAdjacentOffsets(offset);
    offset = neighbors.toSorted((left, right) => {
      const leftCenter = canvas.grid.getCenterPoint(left);
      const rightCenter = canvas.grid.getCenterPoint(right);
      const leftAngle = Math.atan2(leftCenter.y - center.y, leftCenter.x - center.x);
      const rightAngle = Math.atan2(rightCenter.y - center.y, rightCenter.x - center.x);
      return angleDifference(leftAngle, angles[direction]) - angleDifference(rightAngle, angles[direction]);
    })[0] ?? offset;
  }
  return snapshotCanvasPoint(canvas.grid.getCenterPoint(offset));
}

function gridDistance(point, token) {
  const center = token?.center ?? token?.object?.center;
  if (!point || !center || point.sceneId !== canvas.scene?.id || !canvas.grid) return null;
  const measured = Number(canvas.grid.measurePath([{ x: point.x, y: point.y }, center]).distance) || 0;
  return measured / Math.max(1, Number(canvas.scene.grid?.distance) || 1);
}

function automaticBlastTargets(point, radius) {
  if (!point || point.sceneId !== canvas.scene?.id) return [];
  return (canvas.tokens?.placeables ?? []).filter(token => (
    token.actor && Number(gridDistance(point, token)) <= radius
  ));
}

async function resolveUuid(uuid) {
  try { return uuid ? await fromUuid(uuid) : null; }
  catch (_error) { return null; }
}

/** Roll and persist the two-die deviation of a failed explosive attack. */
export async function resolveExplosiveDeviation(message) {
  const attackRoll = message?.rolls?.[0];
  const attack = attackRoll?.options?.attackData;
  if (!attack?.targetPoint || attack.deviation?.resolved) return false;
  const actorDocument = await resolveUuid(attackRoll.options.actorUuid);
  const actor = actorDocument?.actor ?? actorDocument;
  const distance = measureCombatPointDistance(actor, attack.targetPoint);
  const roll = await new Roll('2d6').evaluate();
  const results = roll.dice.flatMap(die => die.results).map(result => Number(result.result) || 1);
  const deviation = resolveDeviation(results[0], results[1], distance?.gridSpaces ?? 0);
  deviation.resolved = true;
  deviation.targetPoint = attack.targetPoint;
  deviation.detonationPoint = deviationPoint(attack.targetPoint, deviation.direction, deviation.distance);
  attack.deviation = deviation;
  attack.detonationPoint = deviation.detonationPoint;
  const content = await attackRoll.render();
  await message.update({ content, rolls: [JSON.stringify(attackRoll)] });
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: localize('YZEGS.Heavy.Deviation.Result', {
      direction: localize(`YZEGS.Heavy.Deviation.Directions.${deviation.direction}`),
      rolled: deviation.rolledDistance,
      maximum: deviation.maximumDistance,
      distance: deviation.distance,
    }),
  });
  if (attack.artillery && actor) {
    await actor.setFlag(SYSTEM_ID, 'artilleryDeviation', {
      itemUuid: attack.sourceItemUuid ?? '',
      targetPoint: attack.targetPoint,
      detonationPoint: deviation.detonationPoint,
    });
  }
  if (deviation.detonationPoint && canvas.scene?.id === deviation.detonationPoint.sceneId) {
    canvas.ping({ x: deviation.detonationPoint.x, y: deviation.detonationPoint.y });
  }
  return deviation;
}

/** Resolve separate, unpushable blast rolls using each selected target's effective blast power. */
export async function resolveBlastTargets(sourceRoll, tokens = []) {
  const attack = sourceRoll?.options?.attackData;
  if (!attack || !getBlastDamageProfile(attack.blast)) return false;
  const confined = Boolean(attack.confinedSpace || isConfinedSpaceScene());
  const indoor = closeQuartersCombatEnabled() || confined;
  const detonationPoint = attack.detonationPoint ?? attack.targetPoint ?? null;
  const choice = await YZEGSDialog.chooseBlastResolution({
    blast: indoor ? increaseIndoorBlast(attack.blast) : attack.blast,
    indoor,
    airburst: Boolean(attack.airburst),
    directional: Boolean(attack.directional),
    automatic: Boolean(detonationPoint),
  });
  if (choice.cancelled) return false;
  const baseProfile = getBlastDamageProfile(choice.blast);
  if (!baseProfile) return false;

  let candidates = [...tokens].filter(token => token?.actor?.uuid);
  if (!candidates.length && detonationPoint && !attack.directional && !choice.contained) {
    candidates = automaticBlastTargets(detonationPoint, getBlastRadius(choice.blast));
  }
  if (!candidates.length) {
    ui.notifications.warn(localize('YZEGS.Urban.Blast.SelectTargets'));
    return false;
  }

  const unique = new Map(candidates.map(token => [token.actor.uuid, token]));
  const skipped = [];
  let affected = 0;
  for (const token of unique.values()) {
    const target = token.actor;
    const enclosing = getEnclosingVehicle(target, game.actors);
    if (target.type !== 'vehicle' && enclosing) {
      skipped.push(localize('YZEGS.Heavy.Blast.VehicleProtected', {
        target: target.name, vehicle: enclosing.vehicle.name,
      }));
      continue;
    }
    const distance = detonationPoint ? Math.max(0, Math.ceil(gridDistance(detonationPoint, token) ?? 0)) : 0;
    const rating = detonationPoint ? getEffectiveBlastRating(choice.blast, {
      distance,
      prone: target.statuses?.has?.('prone'),
      airburst: Boolean(attack.airburst),
      directional: Boolean(attack.directional),
    }) : choice.blast;
    const profile = getBlastDamageProfile(rating);
    if (!profile) {
      skipped.push(localize('YZEGS.Heavy.Blast.OutOfRange', { target: target.name }));
      continue;
    }
    const cover = distance > 0 ? target.coverDetails : null;
    if (cover?.type === 'fullCover'
      && !blastCanPenetrateCover(profile.damage, cover.armor, profile.armorModifier)) {
      skipped.push(localize('YZEGS.Heavy.Blast.CoverProtected', { target: target.name }));
      continue;
    }
    affected++;
    const title = localize('YZEGS.Urban.Blast.RollTitle', { target: target.name, blast: profile.rating });
    await YZEGSRoller.taskCheck({
      title,
      actor: target,
      attribute: profile.die,
      skill: profile.die,
      maxPush: 0,
      locate: true,
      hideCombatActions: true,
      skipDialog: true,
      attackData: {
        damage: profile.damage,
        crit: profile.crit,
        armorModifier: profile.armorModifier,
        blast: profile.rating,
        blastResolution: true,
        blastDistance: distance,
        blastCover: cover,
        ignoreCover: distance === 0,
        contained: Boolean(choice.contained),
        airburst: Boolean(attack.airburst),
        directional: Boolean(attack.directional),
        confinedSpace: confined,
        primaryTargetUuid: target.uuid,
        sourceActorUuid: sourceRoll.options.actorUuid ?? '',
      },
      suppression: {
        force: true,
        blast: true,
        complete: false,
        targets: [{
          actorUuid: target.uuid,
          tokenUuid: token.document?.uuid ?? token.uuid ?? '',
          name: target.name,
          cause: 'blast',
          sourceName: sourceRoll.name ?? '',
          status: target.type === 'vehicle' ? 'immune' : 'pending',
          vehicleName: target.type === 'vehicle' ? target.name : '',
        }],
      },
    });
  }
  const escapeHTML = value => foundry.utils.escapeHTML(String(value ?? ''));
  const skippedList = skipped.length
    ? `<ul>${skipped.map(entry => `<li>${escapeHTML(entry)}</li>`).join('')}</ul>`
    : '';
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `<div class="yzegs chat-card blast-summary"><h3>${localize('YZEGS.Heavy.Blast.SummaryTitle')}</h3>
      <p>${localize('YZEGS.Heavy.Blast.Summary', { affected, skipped: skipped.length })}</p>${skippedList}</div>`,
  });
  return { affected, skipped: skipped.length };
}
