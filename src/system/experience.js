import {
  getAdvancementItemSource,
  getExperienceConfig,
  EXPERIENCE_QUESTION_KEYS,
  WORLD_ADVANCEMENT_ITEM_SOURCE,
} from './experience-config.js';

const NEXT_SKILL_RATING = Object.freeze({ '–': 'D', F: 'D', D: 'C', C: 'B', B: 'A', A: null });
const HISTORY_LIMIT = 100;

function asNonNegativeInteger(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

function assertCanSpend(actor, config) {
  if (!actor.isOwner || (config.gmOnlyAdvancement && !game.user.isGM)) {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.NotPermitted'));
  }
}

function createHistoryEntry(type, amount, data = {}) {
  return {
    id: foundry.utils.randomID(),
    type,
    amount,
    timestamp: Date.now(),
    userId: game.user.id,
    ...data,
  };
}

function historyWith(actor, entry) {
  return [...foundry.utils.deepClone(actor.system.xp.history ?? []), entry].slice(-HISTORY_LIMIT);
}

async function updateXp(actor, { value, total, entry }) {
  const update = {
    'system.xp.value': asNonNegativeInteger(value),
    'system.xp.total': asNonNegativeInteger(total),
    'system.xp.history': historyWith(actor, entry),
  };
  await actor.update(update);
  return entry;
}

/** Return enabled SRD and world-specific session award questions. */
export function getExperienceQuestions(config = getExperienceConfig()) {
  const questions = Object.entries(EXPERIENCE_QUESTION_KEYS)
    .filter(([id]) => config.questions[id] !== false)
    .map(([id, label]) => ({ id, label: game.i18n.localize(label), amount: 1 }));
  config.customQuestions.forEach((label, index) => {
    questions.push({ id: `custom-${index}`, label, amount: 1 });
  });
  return questions;
}

/** Return the next stepped Skill rating and its configured cost. */
export function getSkillAdvancement(skill, actor, config = getExperienceConfig()) {
  const current = Object.hasOwn(NEXT_SKILL_RATING, skill.system.score) ? skill.system.score : '–';
  const target = NEXT_SKILL_RATING[current];
  const cost = target ? asNonNegativeInteger(config.skillCosts[target]) : null;
  const eligible = Boolean(skill.system.advancement?.eligible);
  const currentXp = asNonNegativeInteger(actor.system.xp.value);
  return {
    current,
    target,
    cost,
    eligible,
    learning: current === '–',
    maximum: !target,
    affordable: target ? currentXp >= cost : false,
  };
}

/** Whether the current user may use advancement controls for this Actor. */
export function canManageExperience(actor, config = getExperienceConfig()) {
  if (!actor.isOwner) return false;
  return !config.gmOnlyAdvancement || game.user.isGM;
}

/** Mark whether a Skill has met its meaningful-use or training prerequisite. */
export async function setSkillExperienceEligibility(actor, skillId, eligible) {
  if (!actor.isOwner) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.NotPermitted'));
  const skill = actor.items.get(skillId);
  if (!skill || skill.type !== 'skill') throw new Error(game.i18n.localize('YZEGS.Experience.Errors.SkillMissing'));
  return skill.update({ 'system.advancement.eligible': Boolean(eligible) });
}

/** Award session XP and increase both spendable and lifetime totals. */
export async function awardExperience(actor, { amount, note = '', questions = [] }) {
  if (!game.user.isGM) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.NotPermitted'));
  amount = asNonNegativeInteger(amount);
  if (!amount) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.NoAward'));
  const current = asNonNegativeInteger(actor.system.xp.value);
  const total = asNonNegativeInteger(actor.system.xp.total);
  const entry = createHistoryEntry('award', amount, {
    note: String(note).trim(),
    questions: questions.map(String),
  });
  return updateXp(actor, { value: current + amount, total: total + amount, entry });
}

/** Spend XP and increase an embedded Skill by exactly one step. */
export async function advanceSkill(actor, skillId, { trained = false } = {}) {
  const skill = actor.items.get(skillId);
  if (!skill || skill.type !== 'skill') throw new Error(game.i18n.localize('YZEGS.Experience.Errors.SkillMissing'));
  const config = getExperienceConfig();
  assertCanSpend(actor, config);
  const advancement = getSkillAdvancement(skill, actor, config);
  if (advancement.maximum) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.MaximumSkill'));
  if (!advancement.affordable) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.InsufficientXp'));
  if (config.prerequisiteMode === 'require' && !advancement.eligible && !trained) {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.PrerequisiteRequired'));
  }

  const previousScore = skill.system.score;
  const previousEligibility = Boolean(skill.system.advancement?.eligible);
  await skill.update({
    'system.score': advancement.target,
    'system.advancement.eligible': false,
  });

  const current = asNonNegativeInteger(actor.system.xp.value);
  const total = asNonNegativeInteger(actor.system.xp.total);
  let prerequisite = 'override';
  if (advancement.eligible) prerequisite = 'experience';
  else if (trained) prerequisite = 'training';
  const entry = createHistoryEntry('skill', -advancement.cost, {
    subjectId: skill.id,
    subjectName: skill.name,
    from: advancement.current,
    to: advancement.target,
    prerequisite,
  });

  try {
    return await updateXp(actor, { value: current - advancement.cost, total, entry });
  }
  catch (error) {
    await skill.update({
      'system.score': previousScore,
      'system.advancement.eligible': previousEligibility,
    });
    throw error;
  }
}

/** Return Items of one type from the world-configured advancement source. */
export async function getAdvancementSourceItems(itemType) {
  const source = getAdvancementItemSource();

  if (source === WORLD_ADVANCEMENT_ITEM_SOURCE) {
    return game.items.filter(candidate => candidate.type === itemType);
  }
  if (!source.startsWith('compendium:')) return [];

  const pack = game.packs.get(source.slice('compendium:'.length));
  if (!pack || pack.documentName !== 'Item' || !pack.visible) return [];
  const index = await pack.getIndex({ fields: ['name', 'type'] });
  return index.filter(candidate => candidate.type === itemType).map(entry => ({
    id: entry._id,
    uuid: entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`,
    name: entry.name,
    type: entry.type,
  }));
}

async function getAvailableItemOptions(actor, itemType) {
  const options = {};
  const excludedNames = new Set(actor.itemTypes[itemType].map(item => item.name.toLocaleLowerCase()));
  const optionNames = new Set();
  const addOption = (uuid, itemName) => {
    const normalizedName = itemName?.toLocaleLowerCase();
    if (!uuid || !normalizedName || excludedNames.has(normalizedName) || optionNames.has(normalizedName)) return;
    optionNames.add(normalizedName);
    options[uuid] = itemName;
  };
  for (const item of await getAdvancementSourceItems(itemType)) {
    addOption(item.uuid, item.name);
  }

  return Object.fromEntries(Object.entries(options).sort(([, a], [, b]) => (
    a.localeCompare(b, game.i18n.lang, { sensitivity: 'base' })
  )));
}

/** Collect Skill Items from the configured world-level advancement source. */
export function getAvailableSkillOptions(actor) {
  return getAvailableItemOptions(actor, 'skill');
}

/** Collect Specialty Items from the configured world-level advancement source. */
export function getAvailableSpecialtyOptions(actor) {
  return getAvailableItemOptions(actor, 'specialty');
}

/** Learn a new Skill at D and spend the configured target-D cost. */
export async function learnSkill(actor, sourceUuid, { experienced = false, trained = false } = {}) {
  const source = await fromUuid(sourceUuid);
  if (!source || source.documentName !== 'Item' || source.type !== 'skill') {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.SkillMissing'));
  }
  if (actor.itemTypes.skill.some(item => item.name.toLocaleLowerCase() === source.name.toLocaleLowerCase())) {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.SkillKnown'));
  }
  if (!Object.hasOwn(CONFIG.YZEGS.attributes, source.system.attribute)) {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.InvalidSkill'));
  }

  const config = getExperienceConfig();
  assertCanSpend(actor, config);
  if (config.prerequisiteMode === 'require' && !experienced && !trained) {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.PrerequisiteRequired'));
  }
  const cost = asNonNegativeInteger(config.skillCosts.D);
  const current = asNonNegativeInteger(actor.system.xp.value);
  const total = asNonNegativeInteger(actor.system.xp.total);
  if (current < cost) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.InsufficientXp'));

  const skillData = source.toObject();
  delete skillData._id;
  delete skillData.folder;
  foundry.utils.setProperty(skillData, 'system.score', 'D');
  foundry.utils.setProperty(skillData, 'system.advancement.eligible', false);
  const [created] = await actor.createEmbeddedDocuments('Item', [skillData]);
  let prerequisite = 'override';
  if (experienced) prerequisite = 'experience';
  else if (trained) prerequisite = 'training';
  const entry = createHistoryEntry('skill', -cost, {
    subjectId: created.id,
    subjectName: created.name,
    from: '–',
    to: 'D',
    prerequisite,
  });

  try {
    return await updateXp(actor, { value: current - cost, total, entry });
  }
  catch (error) {
    await actor.deleteEmbeddedDocuments('Item', [created.id]);
    throw error;
  }
}

/** Learn a Specialty from a world or compendium Item and spend its configured cost. */
export async function learnSpecialty(actor, sourceUuid, { trainingSucceeded = false } = {}) {
  if (!trainingSucceeded) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.SpecialtyTrainingRequired'));
  const source = await fromUuid(sourceUuid);
  if (!source || source.documentName !== 'Item' || source.type !== 'specialty') {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.SpecialtyMissing'));
  }
  if (actor.itemTypes.specialty.some(item => item.name.toLocaleLowerCase() === source.name.toLocaleLowerCase())) {
    throw new Error(game.i18n.localize('YZEGS.Experience.Errors.SpecialtyKnown'));
  }

  const config = getExperienceConfig();
  assertCanSpend(actor, config);
  const cost = asNonNegativeInteger(config.specialtyCost);
  const current = asNonNegativeInteger(actor.system.xp.value);
  const total = asNonNegativeInteger(actor.system.xp.total);
  if (current < cost) throw new Error(game.i18n.localize('YZEGS.Experience.Errors.InsufficientXp'));

  const specialtyData = source.toObject();
  delete specialtyData._id;
  delete specialtyData.folder;
  const [created] = await actor.createEmbeddedDocuments('Item', [specialtyData]);
  const entry = createHistoryEntry('specialty', -cost, {
    subjectId: created.id,
    subjectName: created.name,
    prerequisite: 'training',
  });

  try {
    return await updateXp(actor, { value: current - cost, total, entry });
  }
  catch (error) {
    await actor.deleteEmbeddedDocuments('Item', [created.id]);
    throw error;
  }
}
