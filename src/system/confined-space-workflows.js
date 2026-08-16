import { YearZeroRoll } from '../lib/yzur.js';
import {
  collapseOccurs,
  countRicochets,
  getCollapseDieSize,
  getConfinedBlastRating,
  getRicochetShotCount,
} from './confined-space.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

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

function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ''));
}

function markSourceResolution(message, key, value = true) {
  const roll = message?.rolls?.[0];
  if (!roll) return null;
  roll.options.confinedSpaceResolution ??= {};
  roll.options.confinedSpaceResolution[key] = value;
  return roll.render().then(content => message.update({ content, rolls: [JSON.stringify(roll)] }));
}

function tokenCenter(token) {
  const tokenDocument = token.document ?? token;
  const size = canvas.grid.size;
  return {
    x: Number(tokenDocument.x) + ((Number(tokenDocument.width) || 1) * size / 2),
    y: Number(tokenDocument.y) + ((Number(tokenDocument.height) || 1) * size / 2),
  };
}

function nearestRicochetTargets(primaryActor) {
  const primaryToken = primaryActor?.getActiveTokens?.(true, true)?.[0];
  if (!primaryToken || !canvas?.tokens) return [];
  const centerOrigin = tokenCenter(primaryToken);
  const candidates = canvas.tokens.placeables.filter(token => (
    token.actor?.uuid
    && token.actor.uuid !== primaryActor.uuid
    && ['character', 'npc', 'vehicle'].includes(token.actor.type)
  ));
  if (!candidates.length) return [];
  const distances = candidates.map(token => {
    const center = tokenCenter(token);
    return { token, distance: Math.hypot(center.x - centerOrigin.x, center.y - centerOrigin.y) };
  });
  const minimum = Math.min(...distances.map(entry => entry.distance));
  return distances.filter(entry => Math.abs(entry.distance - minimum) < 1).map(entry => entry.token);
}

function renderRicochetCard(data) {
  const appliedLabel = escapeHTML(game.i18n.localize('YZEGS.ConfinedSpace.Applied'));
  const applyLabel = escapeHTML(game.i18n.localize('YZEGS.ConfinedSpace.Ricochet.Apply'));
  const rows = data.hits.map((hit, index) => (
    `<li>${escapeHTML(hit.targetName)} — ${escapeHTML(game.i18n.format('YZEGS.ConfinedSpace.Ricochet.BaseDamage', {
      damage: hit.damage,
    }))}${hit.applied ? ` <i class="fas fa-check"></i> ${appliedLabel}` : `
      <button type="button" class="dice-button apply-ricochet-hit" data-gm-only="true" data-hit-index="${index}">
        <i class="fas fa-crosshairs"></i> ${applyLabel}
      </button>`}</li>`
  )).join('');
  const summary = data.hits.length
    ? `<ul>${rows}</ul>`
    : `<p>${escapeHTML(game.i18n.localize('YZEGS.ConfinedSpace.Ricochet.NoTarget'))}</p>`;
  const title = escapeHTML(game.i18n.localize('YZEGS.ConfinedSpace.Ricochet.Title'));
  const result = escapeHTML(game.i18n.format('YZEGS.ConfinedSpace.Ricochet.Result', {
    shots: data.shots,
    ricochets: data.ricochets,
  }));
  return `<div class="yzegs chat-card confined-space-card">
    <h3><i class="fas fa-arrows-turn-to-dots"></i> ${title}</h3>
    <p>${result}</p>${summary}</div>`;
}

export async function resolveRicochet(message) {
  if (!game.user.isGM) return false;
  const sourceRoll = message?.rolls?.[0];
  const attack = sourceRoll?.options?.attackData;
  if (!attack?.ricochetEligible || sourceRoll.options.confinedSpaceResolution?.ricochet) return false;
  const shots = getRicochetShotCount(sourceRoll.ammoSpent);
  const check = await new Roll(`${shots}d10`).evaluate();
  const values = check.dice.flatMap(die => die.results.filter(result => result.active).map(result => result.result));
  const ricochets = countRicochets(values);
  const primary = await resolveUuid(attack.primaryTargetUuid);
  const candidates = nearestRicochetTargets(primary?.actor ?? primary);
  const hits = Array.from({ length: ricochets }, () => {
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    return target ? {
      targetUuid: target.actor.uuid,
      targetName: target.actor.name,
      damage: Math.max(0, Number(attack.damage) || 0),
      attackData: {
        damage: Math.max(0, Number(attack.damage) || 0),
        crit: Math.max(0, Number(attack.crit) || 0),
        armorModifier: Number(attack.armorModifier) || 0,
        sourceActorUuid: attack.sourceActorUuid ?? sourceRoll.options.actorUuid ?? '',
      },
      applied: false,
    } : null;
  }).filter(Boolean);
  const data = { shots, ricochets, hits };
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    rolls: [check],
    content: renderRicochetCard(data),
    flags: { [SYSTEM_ID]: { confinedRicochet: data } },
  });
  await markSourceResolution(message, 'ricochet');
  return true;
}

export async function applyRicochetHit(message, index) {
  if (!game.user.isGM) return false;
  const data = foundry.utils.deepClone(message.getFlag(SYSTEM_ID, 'confinedRicochet'));
  const hit = data?.hits?.[index];
  if (!hit || hit.applied) return false;
  const targetDocument = await resolveUuid(hit.targetUuid);
  const target = targetDocument?.actor ?? targetDocument;
  if (!target) return false;
  const choice = await foundry.applications.api.DialogV2.input({
    window: { title: game.i18n.localize('YZEGS.ConfinedSpace.Ricochet.Apply') },
    content: `<div class="form-group"><label>${escapeHTML(game.i18n.localize('YZEGS.ItemSheet.Damage'))}</label>
      <div class="form-fields"><input type="number" name="damage" min="0" step="1" value="${hit.damage}"></div></div>`,
    ok: { label: game.i18n.localize('YZEGS.Chat.Actions.ApplyDamage') },
    rejectClose: false,
  });
  if (!choice) return false;
  const damage = Math.max(0, Math.trunc(Number(choice.damage) || 0));
  if (target.type === 'vehicle') {
    await ChatMessage.create({
      content: `<p>${escapeHTML(game.i18n.format('YZEGS.ConfinedSpace.ManualVehicleDamage', {
        target: target.name,
        damage,
      }))}</p>`,
      speaker: ChatMessage.getSpeaker({ actor: target }),
    });
  }
  else await target.applyDamage(damage, foundry.utils.deepClone(hit.attackData), damage !== 0);
  hit.applied = true;
  await message.update({
    content: renderRicochetCard(data),
    [`flags.${SYSTEM_ID}.confinedRicochet`]: data,
  });
  return true;
}

function renderCollapseCard(data) {
  const result = data.collapsed
    ? game.i18n.localize('YZEGS.ConfinedSpace.Collapse.Occurred')
    : game.i18n.localize('YZEGS.ConfinedSpace.Collapse.None');
  const applyLabel = escapeHTML(game.i18n.localize('YZEGS.ConfinedSpace.Collapse.Apply'));
  const action = data.collapsed && !data.applied
    ? `<button type="button" class="dice-button apply-collapse" data-gm-only="true">
        <i class="fas fa-person-falling-burst"></i> ${applyLabel}
      </button>`
    : '';
  const title = escapeHTML(game.i18n.localize('YZEGS.ConfinedSpace.Collapse.Title'));
  const summary = escapeHTML(game.i18n.format('YZEGS.ConfinedSpace.Collapse.Result', {
    blast: data.blast,
    successes: data.successes,
  }));
  return `<div class="yzegs chat-card confined-space-card">
    <h3><i class="fas fa-house-crack"></i> ${title}</h3>
    <p>${summary}</p><p>${escapeHTML(result)}</p>${action}</div>`;
}

async function createCollapseResolution(blastRating) {
  const blast = getConfinedBlastRating(blastRating, true);
  const die = getCollapseDieSize(blast);
  if (!die) return null;
  const check = new YearZeroRoll(`2d${die}`, {}, { maxPush: 0 });
  await check.roll();
  return {
    check,
    data: {
      blast,
      successes: check.successCount,
      collapsed: collapseOccurs(check.successCount),
      applied: false,
    },
  };
}

async function postCollapseResolution(resolution) {
  if (!resolution) return false;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    rolls: [resolution.check],
    content: renderCollapseCard(resolution.data),
    flags: { [SYSTEM_ID]: { confinedCollapse: resolution.data } },
  });
  return true;
}

export async function resolveStandaloneCollapse(blast) {
  if (!game.user.isGM) return false;
  return postCollapseResolution(await createCollapseResolution(blast));
}

export async function resolveCollapse(message) {
  if (!game.user.isGM) return false;
  const sourceRoll = message?.rolls?.[0];
  const attack = sourceRoll?.options?.attackData;
  if (!attack?.confinedSpace || sourceRoll.options.confinedSpaceResolution?.collapse) return false;
  const posted = await postCollapseResolution(await createCollapseResolution(attack.blast));
  if (!posted) return false;
  await markSourceResolution(message, 'collapse');
  return true;
}

function criticalTable(hitLocation) {
  const matcher = hitLocation === 'legs' ? /critical injuries.*leg/i : /critical injuries.*torso/i;
  return [...game.tables].find(table => matcher.test(table.name)) ?? null;
}

export async function applyCollapse(message, tokens) {
  if (!game.user.isGM) return false;
  const data = foundry.utils.deepClone(message.getFlag(SYSTEM_ID, 'confinedCollapse'));
  if (!data?.collapsed || data.applied) return false;
  const targets = [...tokens].map(token => token.actor).filter(actor => (
    actor && ['character', 'npc'].includes(actor.type)
  ));
  if (!targets.length) {
    ui.notifications.warn(game.i18n.localize('YZEGS.ConfinedSpace.Collapse.SelectTargets'));
    return false;
  }
  for (const target of targets) {
    if (!target.statuses?.has?.('pinnedByDebris')) {
      await target.toggleStatusEffect('pinnedByDebris', { active: true });
    }
    const hitLocation = Math.random() < 0.5 ? 'legs' : 'torso';
    const table = criticalTable(hitLocation);
    if (table) await table.draw({ displayChat: true });
    else {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: target }),
        content: `<p>${escapeHTML(game.i18n.format('YZEGS.ConfinedSpace.Collapse.ManualCritical', {
          target: target.name,
          location: game.i18n.localize(`YZEGS.ArmorLocationNames.${hitLocation}`),
        }))}</p>`,
      });
    }
  }
  data.applied = true;
  await message.update({
    content: renderCollapseCard(data),
    [`flags.${SYSTEM_ID}.confinedCollapse`]: data,
  });
  return true;
}
