import { getAdvancementSourceItems } from './experience.js';
import { isRadiationEnabled } from './settings.js';
import { activateRatingMenus } from '../components/rating-menu.js';
import {
  ATTRIBUTE_INCREASE_BUDGET,
  canChooseAttributeRating,
  CREATION_SKILL_RATINGS,
  getAttributeAllocationCost,
  getCapacityValues,
  validateAttributeAllocation,
  validateSkillAllocation,
} from './archetype-rules.js';

const normalizeName = value => String(value ?? '').trim().toLocaleLowerCase();
const ATTRIBUTE_VALIDATION_ERRORS = new Set([
  'YZEGS.Archetype.Errors.InvalidAttributes',
  'YZEGS.Archetype.Errors.TooManyReducedAttributes',
  'YZEGS.Archetype.Errors.AttributeBudget',
]);

async function resolveDocument(reference) {
  if (!reference) return null;
  try {
    const source = await fromUuid(reference);
    if (source) return source;
  }
  catch (_error) {
    // Fall through to a world Item ID for older or hand-authored data.
  }
  return game.items.get(reference) ?? null;
}

async function sourceOption(reference) {
  const source = await resolveDocument(reference);
  return {
    uuid: reference,
    name: source?.name ?? reference,
    type: source?.type ?? '',
    missing: !source,
  };
}

function defaultAttributes() {
  return { str: 'C', agl: 'C', int: 'C', emp: 'C' };
}

async function prepareBuilderContext(actor, archetype) {
  const keySkills = await Promise.all(archetype.system.keySkills.map(sourceOption));
  const availableSkills = await getAdvancementSourceItems('skill');
  const skills = new Map();
  const skillNames = new Set();
  for (const skill of [...keySkills, ...availableSkills]) {
    if (skill.missing) continue;
    const uuid = skill.uuid ?? skill.id;
    const normalized = normalizeName(skill.name);
    if (!uuid || skills.has(uuid) || skillNames.has(normalized)) continue;
    skills.set(uuid, { uuid, name: skill.name, missing: Boolean(skill.missing) });
    skillNames.add(normalized);
  }
  const skillOptions = [...skills.values()].sort((a, b) => (
    a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: 'base' })
  ));
  const defaults = [];
  const preferred = keySkills.find(skill => !skill.missing)?.uuid ?? '';
  if (preferred) defaults.push(preferred);
  for (const skill of skillOptions) {
    if (defaults.length >= 6) break;
    if (!defaults.includes(skill.uuid)) defaults.push(skill.uuid);
  }

  const recommendedSpecialties = await Promise.all(archetype.system.specialties.map(sourceOption));
  const availableSpecialties = await getAdvancementSourceItems('specialty');
  const specialties = new Map();
  const specialtyNames = new Set();
  for (const specialty of [...recommendedSpecialties, ...availableSpecialties]) {
    if (specialty.missing) continue;
    const uuid = specialty.uuid ?? specialty.id;
    const normalized = normalizeName(specialty.name);
    if (!uuid || specialties.has(uuid) || specialtyNames.has(normalized)) continue;
    specialties.set(uuid, { uuid, name: specialty.name, missing: Boolean(specialty.missing) });
    specialtyNames.add(normalized);
  }

  const equipment = await Promise.all(archetype.system.equipment.map(async entry => ({
    ...entry,
    source: await sourceOption(entry.uuid),
  })));
  const fixedEquipment = equipment.filter(entry => !String(entry.group ?? '').trim());
  const equipmentGroups = equipment
    .filter(entry => String(entry.group ?? '').trim())
    .reduce((groups, entry) => {
      const group = entry.group.trim();
      if (!groups[group]) groups[group] = [];
      groups[group].push(entry);
      return groups;
    }, {});
  const groupedEquipment = Object.values(equipmentGroups).map(entries => {
    const firstValid = entries.find(entry => !entry.source.missing);
    return {
      name: entries[0].group.trim(),
      entries: entries.map(entry => ({ ...entry, selected: entry === firstValid })),
    };
  });
  const attributes = defaultAttributes();
  const attributeLabels = Object.fromEntries(Object.entries(CONFIG.YZEGS.attributes).map(([key, label]) => [
    key,
    game.i18n.localize(label),
  ]));
  const rankOptions = archetype.system.rank.options.map((option, index) => ({
    ...option,
    index,
    selected: option.label === actor.system.bio.militaryRank,
  }));
  const specialtyList = [...specialties.values()].map((specialty, index) => ({
    ...specialty,
    recommended: recommendedSpecialties.some(option => option.uuid === specialty.uuid && !option.missing),
    selected: index === 0,
  }));
  const promptOptions = Object.fromEntries(Object.entries(archetype.system.prompts).map(([key, values]) => [
    key,
    Object.fromEntries(values.map(value => [value, value])),
  ]));

  return {
    actor,
    archetype,
    attributes,
    attributeLabels,
    dieScores: ['A', 'B', 'C', 'D'],
    attributeOptions: { A: 'A', B: 'B', C: 'C', D: 'D' },
    skillOptions,
    keySkills: keySkills.filter(skill => !skill.missing),
    specialties: specialtyList,
    specialtyOptions: Object.fromEntries(specialtyList.map(specialty => [
      specialty.uuid,
      `${specialty.name}${specialty.recommended ? ' ★' : ''}`,
    ])),
    selectedSpecialty: specialtyList[0]?.uuid ?? '',
    skillSlots: CREATION_SKILL_RATINGS.map((rating, index) => ({
      id: rating === 'B' ? 'skillB' : `skill${rating}${rating === 'C' ? index : index - 2}`,
      rating,
      options: rating === 'B' ? keySkills.filter(skill => !skill.missing) : skillOptions,
      choices: Object.fromEntries(
        (rating === 'B' ? keySkills.filter(skill => !skill.missing) : skillOptions)
          .map(skill => [skill.uuid, skill.name]),
      ),
      selected: defaults[index] ?? '',
    })),
    branches: archetype.system.branches,
    branchOptions: Object.fromEntries(archetype.system.branches.map(branch => [branch, branch])),
    rank: { ...archetype.system.rank, options: rankOptions },
    rankOptions: Object.fromEntries(rankOptions.map(option => [String(option.index), option.label])),
    selectedRank: String(rankOptions.find(option => option.selected)?.index ?? ''),
    prompts: archetype.system.prompts,
    promptOptions,
    fixedEquipment,
    groupedEquipment,
    hasEquipment: equipment.length > 0,
    radiationEnabled: isRadiationEnabled(),
    existingArchetype: actor.system.creation?.archetypeName ?? '',
    hasExistingData: Boolean(actor.system.creation?.archetypeUuid || actor.items.size),
  };
}

function collectBuilderSelection(form, archetype) {
  const attributes = Object.fromEntries(['str', 'agl', 'int', 'emp'].map(attribute => [
    attribute,
    form.elements.namedItem(`attribute.${attribute}`)?.value ?? 'C',
  ]));
  const skills = {};
  for (const [fieldName, rating] of [
    ['skillB', 'B'], ['skillC1', 'C'], ['skillC2', 'C'],
    ['skillD1', 'D'], ['skillD2', 'D'], ['skillD3', 'D'],
  ]) {
    skills[form.elements.namedItem(fieldName)?.value ?? ''] = rating;
  }
  const equipment = [...form.querySelectorAll('[data-equipment-uuid]:checked:not(:disabled)')]
    .map(input => input.dataset.equipmentUuid);
  const selectedRank = String(form.elements.namedItem('rank')?.value ?? '');
  const rank = selectedRank === '' ? null : archetype.system.rank.options[Number(selectedRank)];
  return {
    characterName: String(form.elements.namedItem('characterName')?.value ?? '').trim(),
    nationality: String(form.elements.namedItem('nationality')?.value ?? '').trim(),
    branch: String(form.elements.namedItem('branch')?.value ?? '').trim(),
    rank: rank?.label ?? '',
    attributes,
    skills,
    specialty: form.elements.namedItem('specialty')?.value ?? '',
    cuf: archetype.system.cuf,
    appearance: String(form.elements.namedItem('appearance')?.value ?? '').trim(),
    moralCode: String(form.elements.namedItem('moralCode')?.value ?? '').trim(),
    bigDream: String(form.elements.namedItem('bigDream')?.value ?? '').trim(),
    groupMeeting: String(form.elements.namedItem('groupMeeting')?.value ?? '').trim(),
    buddy: String(form.elements.namedItem('buddy')?.value ?? '').trim(),
    equipment,
    rads: Math.max(0, Math.trunc(Number(form.elements.namedItem('rads')?.value) || 0)),
    allowOverwrite: form.elements.namedItem('allowOverwrite')?.checked === true,
  };
}

function validationErrors(selection, archetype, actor) {
  const errors = [
    ...validateAttributeAllocation(selection.attributes),
    ...validateSkillAllocation(selection.skills, archetype.system.keySkills),
  ];
  if ((actor.system.creation?.archetypeUuid || actor.items.size) && !selection.allowOverwrite) {
    errors.push('YZEGS.Archetype.Errors.AlreadyApplied');
  }
  if (!selection.characterName) errors.push('YZEGS.Archetype.Errors.CharacterName');
  if (!selection.specialty) errors.push('YZEGS.Archetype.Errors.SpecialtyRequired');
  const equipment = archetype.system.equipment;
  const missingFixed = equipment.some(entry => (
    entry.required && !String(entry.group ?? '').trim() && !selection.equipment.includes(entry.uuid)
  ));
  const requiredGroups = new Set(equipment
    .filter(entry => entry.required && String(entry.group ?? '').trim())
    .map(entry => entry.group.trim()));
  const missingGroup = [...requiredGroups].some(group => !equipment.some(entry => (
    entry.group?.trim() === group && selection.equipment.includes(entry.uuid)
  )));
  if (missingFixed || missingGroup) errors.push('YZEGS.Archetype.Errors.RequiredEquipment');
  return errors;
}

function activateBuilderListeners(dialog, actor, archetype) {
  const applyButton = dialog.element.querySelector('button[data-action="apply"]');
  const form = applyButton?.form
    ?? dialog.element.querySelector('[name="characterName"]')?.form
    ?? dialog.element.querySelector('form');
  if (!form) {
    console.error('yzegs | Archetype builder rendered without a form');
    return;
  }
  activateRatingMenus(dialog.element);
  const updateValidity = () => {
    const selection = collectBuilderSelection(form, archetype);
    const errors = validationErrors(selection, archetype, actor);
    const remaining = ATTRIBUTE_INCREASE_BUDGET - getAttributeAllocationCost(selection.attributes);
    const budgetOutput = dialog.element.querySelector('[data-attribute-budget]');
    if (budgetOutput) {
      budgetOutput.textContent = game.i18n.format('YZEGS.Archetype.AttributeBudgetRemaining', { remaining });
    }
    for (const input of form.querySelectorAll('.rating-menu-input[name^="attribute."]')) {
      const attribute = input.name.slice('attribute.'.length);
      const menu = input.closest('.rating-menu');
      for (const option of menu.querySelectorAll('.rating-menu-option')) {
        option.disabled = option.dataset.value !== input.value
          && !canChooseAttributeRating(selection.attributes, attribute, option.dataset.value);
      }
    }
    if (applyButton) applyButton.disabled = errors.length > 0;
    const attributeOutput = dialog.element.querySelector('[data-attribute-validation]');
    if (attributeOutput) {
      attributeOutput.textContent = errors
        .filter(key => ATTRIBUTE_VALIDATION_ERRORS.has(key))
        .map(key => game.i18n.localize(key))
        .join(' ');
    }
    const output = dialog.element.querySelector('.archetype-validation');
    if (output) {
      output.textContent = errors
        .filter(key => !ATTRIBUTE_VALIDATION_ERRORS.has(key))
        .map(key => game.i18n.localize(key))
        .join(' ');
    }
  };
  form.addEventListener('change', updateValidity);
  form.addEventListener('input', updateValidity);
  const rankButton = dialog.element.querySelector('[data-action="roll-rank"]');
  rankButton?.addEventListener('click', async event => {
    event.preventDefault();
    const formula = archetype.system.rank.formula || '1d6';
    try {
      const roll = await new Roll(formula).evaluate();
      const option = archetype.system.rank.options.find(candidate => (
        roll.total >= Number(candidate.min) && roll.total <= Number(candidate.max)
      ));
      const rankInput = form.elements.namedItem('rank');
      const optionIndex = String(archetype.system.rank.options.indexOf(option));
      const optionButton = [...(rankInput?.closest('.rating-menu')?.querySelectorAll('.rating-menu-option') ?? [])]
        .find(button => button.dataset.value === optionIndex);
      if (option) optionButton?.click();
      ui.notifications.info(game.i18n.format('YZEGS.Archetype.RankRolled', {
        total: roll.total,
        rank: option?.label ?? '–',
      }));
    }
    catch (_error) {
      ui.notifications.error(game.i18n.localize('YZEGS.Archetype.Errors.InvalidRankFormula'));
    }
  });
  dialog.element.querySelector('[data-action="roll-rads"]')?.addEventListener('click', async event => {
    event.preventDefault();
    const roll = await new Roll('1d6').evaluate();
    const input = dialog.element.querySelector('[name="rads"]');
    if (input) input.value = String(roll.total);
  });
  updateValidity();
}

export async function openArchetypeBuilder(actor, archetype) {
  if (actor.type !== 'character' || archetype.type !== 'archetype') {
    ui.notifications.warn(game.i18n.localize('YZEGS.Archetype.Errors.InvalidTarget'));
    return null;
  }
  if (!actor.isOwner) {
    ui.notifications.error(game.i18n.localize('YZEGS.Archetype.Errors.NotPermitted'));
    return null;
  }
  const context = await prepareBuilderContext(actor, archetype);
  if (context.keySkills.length === 0 || context.skillOptions.length < 6) {
    ui.notifications.error(game.i18n.localize('YZEGS.Archetype.Errors.InsufficientSkills'));
    return null;
  }
  if (context.specialties.length === 0) {
    ui.notifications.error(game.i18n.localize('YZEGS.Archetype.Errors.InsufficientSpecialties'));
    return null;
  }
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/archetype-builder.hbs',
    context,
  );
  const wrapper = document.createElement('div');
  wrapper.innerHTML = content;
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ['yzegs', 'archetype-builder-dialog'],
    window: { title: game.i18n.format('YZEGS.Archetype.BuilderTitle', { name: archetype.name }) },
    position: { width: 860, height: 720 },
    content: wrapper,
    buttons: [
      {
        action: 'apply',
        label: game.i18n.localize('YZEGS.Archetype.Apply'),
        default: true,
        callback: (event, button) => {
          const builderSelection = collectBuilderSelection(button.form, archetype);
          const errors = validationErrors(builderSelection, archetype, actor);
          if (errors.length) {
            event.preventDefault();
            ui.notifications.error(errors.map(key => game.i18n.localize(key)).join(' '));
            return false;
          }
          return { confirmed: true, selection: builderSelection };
        },
      },
      {
        action: 'cancel',
        label: game.i18n.localize('YZEGS.Dialog.Actions.Cancel'),
        type: 'button',
        callback: () => false,
      },
    ],
    rejectClose: false,
    close: () => false,
    render: (_event, dialog) => activateBuilderListeners(dialog, actor, archetype),
  });
  if (result?.confirmed !== true) return null;
  const selection = result.selection;
  try {
    await applyArchetype(actor, archetype, selection);
    ui.notifications.info(game.i18n.format('YZEGS.Archetype.Applied', {
      archetype: archetype.name,
      actor: actor.name,
    }));
    return selection;
  }
  catch (error) {
    console.error('yzegs | Failed to apply Archetype', error);
    ui.notifications.error(error.message);
    return null;
  }
}

export async function chooseArchetype(actor) {
  const archetypes = [...game.items]
    .filter(item => item.type === 'archetype')
    .map(item => ({ uuid: item.uuid, name: item.name }));
  for (const pack of game.packs.filter(candidate => candidate.documentName === 'Item' && candidate.visible)) {
    const index = await pack.getIndex({ fields: ['name', 'type'] });
    for (const entry of index.filter(candidate => candidate.type === 'archetype')) {
      archetypes.push({
        uuid: entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`,
        name: entry.name,
      });
    }
  }
  archetypes.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, { sensitivity: 'base' }));
  if (!archetypes.length) {
    ui.notifications.warn(game.i18n.localize('YZEGS.Archetype.Errors.NoArchetypes'));
    return null;
  }
  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/fvtt-yze-generic-stepped/templates/components/dialog/archetype-choice-dialog.hbs',
    { archetypes },
  );
  const wrapper = document.createElement('div');
  wrapper.innerHTML = content;
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ['yzegs'],
    window: { title: game.i18n.localize('YZEGS.Archetype.Choose') },
    content: wrapper,
    buttons: [
      {
        action: 'confirm',
        label: game.i18n.localize('YZEGS.Dialog.Actions.Ok'),
        default: true,
        callback: (_event, button) => button.form.elements.namedItem('archetype')?.value,
      },
      {
        action: 'cancel',
        label: game.i18n.localize('YZEGS.Dialog.Actions.Cancel'),
        type: 'button',
        callback: () => false,
      },
    ],
    rejectClose: false,
    close: () => false,
  });
  if (!result) return null;
  const archetype = await resolveDocument(result);
  return archetype ? openArchetypeBuilder(actor, archetype) : null;
}

async function rollQuantity(formula) {
  formula = String(formula || '1').trim();
  const numeric = Number(formula);
  if (Number.isFinite(numeric)) return Math.max(1, Math.trunc(numeric));
  const roll = await new Roll(formula).evaluate();
  return Math.max(1, Math.trunc(Number(roll.total) || 1));
}

function cleanItemData(source) {
  const data = source.toObject();
  delete data._id;
  delete data.folder;
  delete data.ownership;
  delete data.sort;
  return data;
}

export async function applyArchetype(actor, archetype, selection) {
  const errors = validationErrors(selection, archetype, actor);
  if (errors.length) throw new Error(errors.map(key => game.i18n.localize(key)).join(' '));
  if (!actor.isOwner) throw new Error(game.i18n.localize('YZEGS.Archetype.Errors.NotPermitted'));

  const selectedSkills = await Promise.all(Object.entries(selection.skills).map(async ([reference, rating]) => ({
    document: await resolveDocument(reference),
    reference,
    rating,
  })));
  if (selectedSkills.some(skill => skill.document?.type !== 'skill')) {
    throw new Error(game.i18n.localize('YZEGS.Archetype.Errors.InvalidSkillReference'));
  }
  const specialty = selection.specialty ? await resolveDocument(selection.specialty) : null;
  if (selection.specialty && specialty?.type !== 'specialty') {
    throw new Error(game.i18n.localize('YZEGS.Archetype.Errors.InvalidSpecialtyReference'));
  }
  const equipmentEntries = archetype.system.equipment.filter(entry => selection.equipment.includes(entry.uuid));
  const equipment = await Promise.all(equipmentEntries.map(async entry => ({
    entry,
    document: await resolveDocument(entry.uuid),
    quantity: await rollQuantity(entry.quantityFormula),
  })));
  if (equipment.some(item => !CONFIG.YZEGS.physicalItems.includes(item.document?.type))) {
    throw new Error(game.i18n.localize('YZEGS.Archetype.Errors.InvalidEquipmentReference'));
  }

  const capacities = getCapacityValues(selection.attributes);
  const actorUpdate = {
    name: selection.characterName,
    'system.bio.nationality': selection.nationality,
    'system.bio.branch': selection.branch,
    'system.bio.militaryRank': selection.rank,
    'system.bio.buddy': selection.buddy,
    'system.bio.appearance': selection.appearance,
    'system.bio.moralCode': selection.moralCode,
    'system.bio.bigDream': selection.bigDream,
    'system.bio.groupMeeting': selection.groupMeeting,
    'system.attributes.str.score': selection.attributes.str,
    'system.attributes.agl.score': selection.attributes.agl,
    'system.attributes.int.score': selection.attributes.int,
    'system.attributes.emp.score': selection.attributes.emp,
    'system.cuf.score': archetype.system.cuf,
    'system.health.value': capacities.health + Number(actor.system.health.modifier ?? 0),
    'system.sanity.value': capacities.sanity + Number(actor.system.sanity.modifier ?? 0),
    'system.creation.archetypeUuid': archetype.uuid,
    'system.creation.archetypeName': archetype.name,
    'system.creation.appliedAt': Date.now(),
    'system.creation.selections': foundry.utils.deepClone(selection),
  };
  if (isRadiationEnabled()) actorUpdate['system.rads.permanent'] = selection.rads;

  const actorSnapshot = Object.fromEntries(Object.keys(actorUpdate).map(path => [
    path,
    foundry.utils.deepClone(foundry.utils.getProperty(actor, path)),
  ]));
  const existingByKey = new Map(actor.items.map(item => [`${item.type}:${normalizeName(item.name)}`, item]));
  const creates = [];
  const updates = [];
  const itemSnapshots = [];

  for (const skill of selectedSkills) {
    const existing = existingByKey.get(`skill:${normalizeName(skill.document.name)}`);
    if (existing) {
      itemSnapshots.push({ _id: existing.id, 'system.score': existing.system.score });
      updates.push({ _id: existing.id, 'system.score': skill.rating });
    }
    else {
      const data = cleanItemData(skill.document);
      foundry.utils.setProperty(data, 'system.score', skill.rating);
      creates.push(data);
    }
  }
  const selectedSkillNames = new Set(selectedSkills.map(skill => normalizeName(skill.document.name)));
  for (const existing of actor.itemTypes.skill) {
    if (selectedSkillNames.has(normalizeName(existing.name)) || existing.system.score === '–') continue;
    itemSnapshots.push({ _id: existing.id, 'system.score': existing.system.score });
    updates.push({ _id: existing.id, 'system.score': '–' });
  }
  if (specialty && !existingByKey.has(`specialty:${normalizeName(specialty.name)}`)) {
    creates.push(cleanItemData(specialty));
  }
  for (const item of equipment) {
    const key = `${item.document.type}:${normalizeName(item.document.name)}`;
    const existing = existingByKey.get(key);
    if (existing) {
      itemSnapshots.push({ _id: existing.id, 'system.qty': existing.system.qty });
      updates.push({ _id: existing.id, 'system.qty': Math.max(Number(existing.system.qty), item.quantity) });
    }
    else {
      const data = cleanItemData(item.document);
      foundry.utils.setProperty(data, 'system.qty', item.quantity);
      creates.push(data);
    }
  }

  let created = [];
  try {
    await actor.update(actorUpdate);
    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
    if (creates.length) created = await actor.createEmbeddedDocuments('Item', creates);
  }
  catch (error) {
    try {
      if (created.length) await actor.deleteEmbeddedDocuments('Item', created.map(item => item.id));
      if (itemSnapshots.length) await actor.updateEmbeddedDocuments('Item', itemSnapshots);
      await actor.update(actorSnapshot);
    }
    catch (rollbackError) {
      console.error('yzegs | Archetype rollback failed', rollbackError);
    }
    throw error;
  }
  return { actor, created, updated: updates };
}
