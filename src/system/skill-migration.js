import { LEGACY_SKILLS } from './legacy-skills.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';
export const SKILL_ITEMS_MIGRATION_SETTING = 'skillItemsMigrationComplete';
export const WORLD_SKILL_CLEANUP_SETTING = 'worldSkillCleanupComplete';

/**
 * Convert the former fixed Actor skills into Skill Items and update stored references.
 */
export async function migrateLegacySkills() {
  if (!game.user.isGM || game.settings.get(SYSTEM_ID, SKILL_ITEMS_MIGRATION_SETTING)) return;

  ui.notifications.info('Converting legacy skills to Skill Items. Please wait.');

  try {
    const migratedWorldSkills = getMigratedWorldSkills();
    const worldSkillMap = createSkillReferenceMap(
      Object.fromEntries(Object.entries(LEGACY_SKILLS).map(([legacyKey, definition]) => [
        legacyKey,
        definition.id,
      ])),
      migratedWorldSkills,
    );

    for (const item of game.items) await migrateItemReferences(item, worldSkillMap);

    for (const actor of game.actors) {
      const actorSkillMap = ['character', 'npc'].includes(actor.type)
        ? await createActorSkills(actor, migratedWorldSkills)
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

async function createActorSkills(actor, migratedWorldSkills = []) {
  const skillIdsByLegacyKey = {};
  const skillData = [];

  for (const [legacyKey, definition] of Object.entries(LEGACY_SKILLS)) {
    const existing = getLegacySkill(actor.items, legacyKey) ?? actor.items.get(definition.id);
    if (existing?.type === 'skill') {
      skillIdsByLegacyKey[legacyKey] = existing.id;
      continue;
    }

    const id = actor.items.has(definition.id) ? foundry.utils.randomID() : definition.id;
    const score = actor.system.skills?.[legacyKey]?.score ?? '–';
    skillIdsByLegacyKey[legacyKey] = id;
    skillData.push(buildSkillData(legacyKey, definition, id, score));
  }

  if (skillData.length) await actor.createEmbeddedDocuments('Item', skillData, { keepId: true });
  return createSkillReferenceMap(skillIdsByLegacyKey, migratedWorldSkills);
}

function buildSkillData(legacyKey, definition, id, score) {
  return {
    _id: id,
    name: game.i18n.localize(definition.label),
    type: 'skill',
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

function createSkillReferenceMap(skillIdsByLegacyKey, migratedWorldSkills = []) {
  const referenceMap = {};
  for (const [legacyKey, definition] of Object.entries(LEGACY_SKILLS)) {
    const targetId = skillIdsByLegacyKey[legacyKey];
    if (!targetId) continue;
    referenceMap[legacyKey] = targetId;
    referenceMap[definition.id] = targetId;
  }
  for (const skill of migratedWorldSkills) {
    const legacyKey = skill.getFlag(SYSTEM_ID, 'legacySkillKey');
    if (skillIdsByLegacyKey[legacyKey]) referenceMap[skill.id] = skillIdsByLegacyKey[legacyKey];
  }
  return referenceMap;
}

function getMigratedWorldSkills() {
  return game.items.filter(item => (
    item.type === 'skill'
    && Object.hasOwn(LEGACY_SKILLS, item.getFlag(SYSTEM_ID, 'legacySkillKey'))
  ));
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

/**
 * Remove only the global Skill Items created by the original conversion.
 * Character and NPC Skills remain embedded so that their individual ratings are preserved.
 */
export async function removeMigratedWorldSkills() {
  if (!game.user.isGM || game.settings.get(SYSTEM_ID, WORLD_SKILL_CLEANUP_SETTING)) return;

  try {
    const migratedWorldSkills = getMigratedWorldSkills();
    if (migratedWorldSkills.length) {
      const folderIds = new Set(migratedWorldSkills.map(skill => skill.folder?.id).filter(Boolean));
      const canonicalSkillMap = createSkillReferenceMap(
        Object.fromEntries(Object.entries(LEGACY_SKILLS).map(([legacyKey, definition]) => [
          legacyKey,
          definition.id,
        ])),
        migratedWorldSkills,
      );

      for (const item of game.items) await migrateItemReferences(item, canonicalSkillMap);
      for (const actor of game.actors) {
        const actorSkillMap = ['character', 'npc'].includes(actor.type)
          ? await createActorSkills(actor, migratedWorldSkills)
          : canonicalSkillMap;
        for (const item of actor.items) await migrateItemReferences(item, actorSkillMap);
      }

      await Item.deleteDocuments(migratedWorldSkills.map(skill => skill.id));
      for (const folderId of folderIds) {
        const folder = game.folders.get(folderId);
        if (folder?.type === 'Item' && !folder.contents?.length && !folder.children?.length) {
          await folder.delete();
        }
      }
    }

    await game.settings.set(SYSTEM_ID, WORLD_SKILL_CLEANUP_SETTING, true);
    if (migratedWorldSkills.length) {
      ui.notifications.info('System Skill Items were removed from the world; they remain available in the compendium.');
    }
  }
  catch (error) {
    console.error('YZEGS | World Skill Item cleanup failed.', error);
    ui.notifications.error('World Skill Item cleanup failed. Check the console for details.', { permanent: true });
  }
}
