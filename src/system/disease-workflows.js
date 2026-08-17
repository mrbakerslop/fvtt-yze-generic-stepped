import { YZEGSRoller, getAttributeAndSkill } from '../components/roll/dice.js';
import YZEGSDialog from '../components/dialog/dialog.js';
import { getActorActionSkill } from './action-skills.js';
import { killActor } from './critical-injuries.js';
import {
  diseaseBlocksRecovery,
  diseaseCheckModifier,
  getDiseaseOutcome,
  hazardDurationSeconds,
} from './disease-rules.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';

function primaryActiveGM() {
  return game.users.find(user => user.active && user.isGM) ?? null;
}

async function rollFormula(formula) {
  try {
    const roll = await new Roll(String(formula || '1')).evaluate();
    return Math.max(0, Number(roll.total) || 0);
  }
  catch (_error) {
    return Math.max(0, Number(formula) || 0);
  }
}

async function nextDiseaseDeadline(timing, now = game.time.worldTime) {
  const amount = await rollFormula(timing?.formula ?? '1');
  return Number(now) + hazardDurationSeconds(amount, timing?.unit);
}

export async function initializeOwnedDisease(actor, disease) {
  if (!actor || disease?.type !== 'disease' || disease.system.state?.phase) return disease;
  const now = Number(game.time.worldTime) || 0;
  return disease.update({
    'system.state.phase': 'incubating',
    'system.state.exposedAt': now,
    'system.state.dueWorldTime': await nextDiseaseDeadline(disease.system.incubation, now),
    'system.state.due': false,
  });
}

export async function exposeActorToDisease(actor, source) {
  if (!actor || !['character', 'npc'].includes(actor.type) || source?.type !== 'disease') return null;
  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'system.state', {});
  const [disease] = await actor.createEmbeddedDocuments('Item', [data]);
  await initializeOwnedDisease(actor, disease);
  return disease;
}

export function actorRecoveryBlocked(actor, track = 'damage') {
  if (!['character', 'npc'].includes(actor?.type)) return false;
  if (actor.itemTypes.disease?.some(disease => diseaseBlocksRecovery(disease, track))) return true;
  if (actor.system.conditions?.hypothermic) return true;
  if (track === 'damage') {
    return Boolean(actor.system.conditions?.starving || actor.system.conditions?.dehydrated);
  }
  return Boolean(actor.system.conditions?.sleepless);
}

async function applyDiseaseHarm(actor, disease) {
  const damage = Math.max(0, Number(disease.system.harm?.damage) || 0);
  const stress = Math.max(0, Number(disease.system.harm?.stress) || 0);
  const health = Math.max(0, Number(actor.system.health?.value) - damage);
  const sanity = Math.max(0, Number(actor.system.sanity?.value) - stress);
  const update = {};
  if (damage) update['system.health.value'] = health;
  if (stress) update['system.sanity.value'] = sanity;
  if (Object.keys(update).length) await actor.update(update);
  return { damage, stress, incapacitated: damage > 0 && health <= 0 };
}

async function postDiseaseResult(patient, disease, { healer, successes, outcome, harm }) {
  const result = outcome.recovered
    ? game.i18n.localize('YZEGS.Disease.RecoveredResult')
    : game.i18n.format('YZEGS.Disease.FailedResult', { damage: harm.damage, stress: harm.stress });
  const content = `<section class="yzegs chat-card disease-result">
    <h3>${foundry.utils.escapeHTML(disease.name)}</h3>
    <p><strong>${game.i18n.localize('YZEGS.Disease.Patient')}:</strong> ${foundry.utils.escapeHTML(patient.name)}</p>
    ${healer && healer !== patient ? `<p><strong>${game.i18n.localize('YZEGS.Disease.Caregiver')}:</strong>
      ${foundry.utils.escapeHTML(healer.name)}</p>` : ''}
    <p><strong>${game.i18n.localize('YZEGS.Disease.Successes')}:</strong> ${successes}</p><p>${result}</p>
  </section>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: healer ?? patient }), content });
}

export async function resolveDiseaseCheck(patient, disease, { healer = patient } = {}) {
  if (!patient || disease?.type !== 'disease' || disease.parent !== patient) return null;
  const medical = healer !== patient;
  const actionId = medical ? 'diseaseTreatment' : 'diseaseCheck';
  const fallback = medical ? 'medicalAid' : 'stamina';
  const skill = getActorActionSkill(healer, actionId, fallback);
  if (!skill) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Disease.MissingSkill'));
    return null;
  }
  const stat = getAttributeAndSkill(skill, healer);
  const roll = await YZEGSRoller.taskCheck({
    ...stat,
    title: game.i18n.format('YZEGS.Disease.CheckTitle', { disease: disease.name, patient: patient.name }),
    actor: healer,
    modifier: diseaseCheckModifier(disease, { medical }),
    maxPush: 0,
    lockMaxPush: true,
    hideCombatActions: true,
    allowWhileIncapacitated: healer === patient,
    sendMessage: false,
  });
  if (!roll) return null;
  await roll.toMessage();
  const successes = Number(roll.successCount) || 0;
  const outcome = getDiseaseOutcome({ phase: disease.system.state.phase, successes });
  const now = Number(game.time.worldTime) || 0;
  let harm = { damage: 0, stress: 0, incapacitated: false };
  const update = {
    'system.state.phase': outcome.nextPhase,
    'system.state.due': false,
    'system.state.caregiverUuid': medical ? healer.uuid : '',
    'system.state.caregiverName': medical ? healer.name : '',
  };
  if (outcome.recovered) update['system.state.dueWorldTime'] = 0;
  else {
    harm = await applyDiseaseHarm(patient, disease);
    update['system.state.failedChecks'] = (Number(disease.system.state.failedChecks) || 0) + 1;
    update['system.state.dueWorldTime'] = await nextDiseaseDeadline(disease.system.interval, now);
    if (harm.incapacitated && disease.system.lethalWhenIncapacitated) {
      update['system.state.incapacitatedAt'] = now;
      update['system.state.deathDeadline'] = now + hazardDurationSeconds(1, 'day');
    }
  }
  await disease.update(update);
  await postDiseaseResult(patient, disease, { healer, successes, outcome, harm });
  return { successes, outcome, harm };
}

export async function chooseDiseaseCaregiver(patient, disease) {
  const candidates = game.actors.filter(actor => (
    ['character', 'npc'].includes(actor.type) && actor.isOwner
  ));
  const choices = Object.fromEntries(candidates.map(actor => [actor.id, actor.name]));
  if (!Object.keys(choices).length) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Disease.NoCaregiver'));
    return null;
  }
  const result = await YZEGSDialog.chooseActor(choices);
  if (result.cancelled) return null;
  return resolveDiseaseCheck(patient, disease, { healer: game.actors.get(result.actor) });
}

export async function advanceDiseaseWorldTime(_worldTime, _delta, _options, userId) {
  if (userId !== game.user.id || primaryActiveGM()?.id !== game.user.id) return;
  const now = Number(game.time.worldTime) || 0;
  for (const actor of game.actors.filter(entry => ['character', 'npc'].includes(entry.type))) {
    for (const disease of actor.itemTypes.disease ?? []) {
      const state = disease.system.state ?? {};
      if (state.phase === 'recovered') continue;
      if (state.deathDeadline > 0 && now >= state.deathDeadline && Number(actor.system.health.value) <= 0) {
        await killActor(actor, { reason: disease.name });
        continue;
      }
      if (!state.due && state.dueWorldTime > 0 && now >= state.dueWorldTime) {
        await disease.update({ 'system.state.due': true });
        ui.notifications.warn(game.i18n.format('YZEGS.Disease.CheckDue', {
          actor: actor.name,
          disease: disease.name,
        }));
      }
    }
  }
}

export async function initializeDiseaseStates() {
  if (primaryActiveGM()?.id !== game.user.id) return;
  for (const actor of game.actors.filter(entry => ['character', 'npc'].includes(entry.type))) {
    for (const disease of actor.itemTypes.disease ?? []) await initializeOwnedDisease(actor, disease);
  }
}

export { SYSTEM_ID as DISEASE_SYSTEM_ID };
