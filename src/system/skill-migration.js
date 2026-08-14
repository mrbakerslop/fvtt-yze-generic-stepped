import { LEGACY_SKILLS } from './legacy-skills.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const SKILL_ITEMS_MIGRATION_SETTING = 'skillItemsMigrationComplete';

/**
 * Convert the former fixed Actor skills into Skill Items and update stored references.
 */
export async function migrateLegacySkills() {
  if (!game.user.isGM || game.settings.get(SYSTEM_ID, SKILL_ITEMS_MIGRATION_SETTING)) return;

  ui.notifications.info('Converting legacy skills to Skill Items. Please wait.');

  try {
    const folder = await getSkillsFolder();
    const worldSkillMap = await createWorldSkills(folder);

    for (const item of game.items) await migrateItemReferences(item, worldSkillMap);

    for (const actor of game.actors) {
      const actorSkillMap = ['character', 'npc'].includes(actor.type)
        ? await createActorSkills(actor)
        : worldSkillMap;
      for (const item of actor.items) await migrateItemReferences(item, actorSkillMap);
    }

    await game.settings.set(SYSTEM_ID, SKILL_ITEMS_MIGRATION_SETTING, true);
    ui.notifications.info('Legacy skills were converted to Skill Items.');
  }
  catch (error) {
    console.error('YZEGS | Skill Item migration failed.', error);
    ui.notifications.error('Skill Item migration failed. Check the console for details.', { permanent: true });
  }
}

async function getSkillsFolder() {
  const folderName = game.i18n.localize('YZEGS.Skills');
  const existing = game.folders.find(folder => folder.type === 'Item' && folder.name === folderName);
  return existing ?? Folder.create({
    name: folderName,
    type: 'Item',
  });
}

async function createWorldSkills(folder) {
  const idMap = {};
  const skillData = [];

  for (const [legacyKey, definition] of Object.entries(LEGACY_SKILLS)) {
    const existing = getLegacySkill(game.items, legacyKey) ?? game.items.get(definition.id);
    if (existing?.type === 'skill') {
      idMap[legacyKey] = existing.id;
      continue;
    }

    const id = game.items.has(definition.id) ? foundry.utils.randomID() : definition.id;
    idMap[legacyKey] = id;
    skillData.push(buildSkillData(legacyKey, definition, id, '–', folder.id));
  }

  if (skillData.length) await Item.createDocuments(skillData, { keepId: true });
  return idMap;
}

async function createActorSkills(actor) {
  const idMap = {};
  const skillData = [];

  for (const [legacyKey, definition] of Object.entries(LEGACY_SKILLS)) {
    const existing = getLegacySkill(actor.items, legacyKey) ?? actor.items.get(definition.id);
    if (existing?.type === 'skill') {
      idMap[legacyKey] = existing.id;
      continue;
    }

    const id = actor.items.has(definition.id) ? foundry.utils.randomID() : definition.id;
    const score = actor.system.skills?.[legacyKey]?.score ?? '–';
    idMap[legacyKey] = id;
    skillData.push(buildSkillData(legacyKey, definition, id, score));
  }

  if (skillData.length) await actor.createEmbeddedDocuments('Item', skillData, { keepId: true });
  return idMap;
}

function buildSkillData(legacyKey, definition, id, score, folder = null) {
  return {
    _id: id,
    name: game.i18n.localize(definition.label),
    type: 'skill',
    folder,
    system: {
      attribute: definition.attribute,
      score,
      description: '',
    },
    flags: {
      [SYSTEM_ID]: { legacySkillKey: legacyKey },
    },
  };
}

function getLegacySkill(collection, legacyKey) {
  return collection.find(item => (
    item.type === 'skill'
    && item.getFlag(SYSTEM_ID, 'legacySkillKey') === legacyKey
  ));
}

async function migrateItemReferences(item, skillIdMap) {
  const updateData = {};
  if (skillIdMap[item.system.skill]) updateData['system.skill'] = skillIdMap[item.system.skill];

  const modifiers = foundry.utils.deepClone(item.system.rollModifiers ?? {});
  let modifiersChanged = false;
  for (const modifier of Object.values(modifiers)) {
    if (!modifier?.name?.startsWith('skill.')) continue;
    const legacyKey = modifier.name.slice('skill.'.length);
    if (!skillIdMap[legacyKey]) continue;
    modifier.name = `skill.${skillIdMap[legacyKey]}`;
    modifiersChanged = true;
  }
  if (modifiersChanged) updateData['system.rollModifiers'] = modifiers;

  if (!foundry.utils.isEmpty(updateData)) await item.update(updateData);
}
