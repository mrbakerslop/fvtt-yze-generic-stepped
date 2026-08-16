import {
  chooseEngagementTarget,
  closeQuartersCombatEnabled,
  CQ_ENGAGEMENT_FLAG,
  urbanCombatEnabled,
  URBAN_SYSTEM_ID,
} from './urban-operations.js';

const URBAN_SOCKET = `system.${URBAN_SYSTEM_ID}`;

async function resolveUuid(uuid) {
  if (!uuid) return null;
  try {
    // eslint-disable-next-line no-undef
    return await fromUuid(uuid);
  }
  catch (_error) {
    return null;
  }
}

function actorFromDocument(doc) {
  return doc?.actor ?? doc;
}

async function setEngagedStatus(actor, active) {
  if (!actor || actor.statuses?.has?.('engaged') === active) return;
  await actor.toggleStatusEffect('engaged', { active });
}

function responsibleGM() {
  return [...game.users].filter(user => user.active && user.isGM)
    .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function userOwnsActor(user, actor) {
  return Boolean(user && actor && (
    user.isGM || actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
  ));
}

async function setEngagementSide(actor, partnerUuid) {
  await actor.setFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG, partnerUuid);
  await setEngagedStatus(actor, true);
}

/** Remove an indoor attacker's cover after firing at someone hugging the same wall. */
export async function exposeAttackerForHuggingWall(attacker, target) {
  if (!urbanCombatEnabled() || !attacker || !target?.statuses?.has?.('huggingWall')) return false;
  const cover = attacker.getFlag(URBAN_SYSTEM_ID, 'actionCover');
  if (!cover || (!attacker.statuses?.has?.('partialCover') && !attacker.statuses?.has?.('fullCover'))) return false;
  await attacker.setFlag(URBAN_SYSTEM_ID, 'urbanRestoreCover', cover);
  await attacker.toggleStatusEffect('partialCover', { active: false });
  await attacker.toggleStatusEffect('fullCover', { active: false });
  await attacker.unsetFlag(URBAN_SYSTEM_ID, 'actionCover');
  ui.notifications.info(game.i18n.format('YZEGS.Urban.HuggingWall.Exposed', { attacker: attacker.name }));
  return true;
}

/** Restore cover lost to wall-hugging when the attacker's next turn begins. */
export async function restoreHuggingWallCover(combat, changes, userId) {
  if (!Object.hasOwn(changes, 'turn') || !game.user.isGM || userId !== game.user.id) return false;
  const actor = combat.combatant?.actor;
  const cover = actor?.getFlag?.(URBAN_SYSTEM_ID, 'urbanRestoreCover');
  if (!actor || !cover) return false;
  await actor.setFlag(URBAN_SYSTEM_ID, 'actionCover', cover);
  await actor.toggleStatusEffect(cover.type, { active: true });
  await actor.unsetFlag(URBAN_SYSTEM_ID, 'urbanRestoreCover');
  return true;
}

export async function clearCombatEngagements(combat, userId) {
  if (!game.user.isGM || userId !== game.user.id) return [];
  const actors = [...new Map([...combat.combatants].filter(combatant => combatant.actor?.uuid)
    .map(combatant => [combatant.actor.uuid, combatant.actor])).values()];
  const cleared = [];
  for (const actor of actors) {
    if (!actor.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG)) continue;
    await clearCloseQuartersEngagement(actor);
    cleared.push(actor);
  }
  return cleared;
}

/** Mark a mutual close-quarters engagement where document permissions allow it. */
export async function beginCloseQuartersEngagement(actor, target) {
  if (!closeQuartersCombatEnabled() || !actor?.uuid || !target?.uuid || actor.uuid === target.uuid) return false;
  await setEngagementSide(actor, target.uuid);
  if (game.user.isGM || target.isOwner) {
    await setEngagementSide(target, actor.uuid);
  }
  else {
    game.socket.emit(URBAN_SOCKET, {
      type: 'urbanBeginEngagement',
      actorUuid: actor.uuid,
      partnerUuid: target.uuid,
      requesterId: game.user.id,
    });
  }
  return true;
}

/** Clear an engagement on this Actor and, when permitted, its counterpart. */
export async function clearCloseQuartersEngagement(actor) {
  const partnerUuid = actor?.getFlag?.(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG);
  if (!actor || !partnerUuid) return false;
  const partner = actorFromDocument(await resolveUuid(partnerUuid));
  await actor.unsetFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG);
  await setEngagedStatus(actor, false);
  if (partner && (game.user.isGM || partner.isOwner)) {
    if (partner.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG) === actor.uuid) {
      await partner.unsetFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG);
    }
    await setEngagedStatus(partner, false);
  }
  else if (partner) {
    game.socket.emit(URBAN_SOCKET, {
      type: 'urbanClearEngagement',
      actorUuid: actor.uuid,
      partnerUuid: partner.uuid,
      requesterId: game.user.id,
    });
  }
  return true;
}

/** Resolve the 50/50 target of third-party fire into an engagement. */
export async function resolveEngagementFireTarget(attacker, intendedTarget, random = Math.random) {
  if (!closeQuartersCombatEnabled() || !attacker || !intendedTarget) return intendedTarget;
  const partnerUuid = intendedTarget.getFlag?.(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG);
  if (!partnerUuid || [intendedTarget.uuid, partnerUuid].includes(attacker.uuid)) return intendedTarget;
  const selectedUuid = chooseEngagementTarget(intendedTarget.uuid, partnerUuid, random);
  const selected = actorFromDocument(await resolveUuid(selectedUuid));
  if (selected && selected.uuid !== intendedTarget.uuid) {
    ui.notifications.info(game.i18n.format('YZEGS.Urban.Engagement.RandomTarget', { target: selected.name }));
  }
  return selected ?? intendedTarget;
}

async function handleUrbanSocket(payload) {
  if (responsibleGM()?.id !== game.user.id) return;
  const actor = actorFromDocument(await resolveUuid(payload.actorUuid));
  const partner = actorFromDocument(await resolveUuid(payload.partnerUuid));
  const requester = game.users.get(payload.requesterId);
  if (!actor || !partner || !userOwnsActor(requester, actor)) return;
  if (payload.type === 'urbanBeginEngagement') {
    if (!closeQuartersCombatEnabled()) return;
    await setEngagementSide(actor, partner.uuid);
    await setEngagementSide(partner, actor.uuid);
  }
  else if (payload.type === 'urbanClearEngagement') {
    if (actor.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG) === partner.uuid) {
      await actor.unsetFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG);
      await setEngagedStatus(actor, false);
    }
    if (partner.getFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG) === actor.uuid) {
      await partner.unsetFlag(URBAN_SYSTEM_ID, CQ_ENGAGEMENT_FLAG);
      await setEngagedStatus(partner, false);
    }
  }
}

export function registerUrbanSocket() {
  game.socket.on(URBAN_SOCKET, payload => {
    if (!['urbanBeginEngagement', 'urbanClearEngagement'].includes(payload?.type)) return;
    handleUrbanSocket(payload)
      .catch(error => console.error('yzegs | Urban Operations socket update failed.', error));
  });
}
