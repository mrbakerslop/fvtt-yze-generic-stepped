import assert from 'node:assert/strict';
import test from 'node:test';

import { installFoundryRuntime } from './helpers/foundry-runtime.js';

const legacyGear = (id = 'legacyGear') => ({
  _id: id,
  type: 'gear',
  system: { modifiers: { attributes: { str: 1 } } },
});

test('14.0.14 worlds run the 14.0.15 data migration', async () => {
  const runtime = installFoundryRuntime();
  foundry.utils.isNewerVersion = (candidate, current) => (
    candidate.localeCompare(current, undefined, { numeric: true }) > 0
  );
  await game.settings.set('fvtt-yze-generic-stepped', 'systemMigrationVersion', '14.0.14');
  const { checkMigration } = await import('../src/system/migration.js');

  await checkMigration();

  assert.equal(
    runtime.settingValues.get('fvtt-yze-generic-stepped.systemMigrationVersion'),
    '14.0.15',
  );
});

test('Actor migration covers legacy fields, owned Items, and the Mountain spelling', async () => {
  installFoundryRuntime();
  const { migrateActorData } = await import('../src/system/migration.js');

  const characterUpdate = migrateActorData({
    type: 'character',
    system: { crits: ['legacy'] },
    items: [legacyGear()],
  });
  assert.ok(characterUpdate['system.crits'] instanceof foundry.data.operators.ForcedDeletion);
  assert.equal(characterUpdate.items.length, 1);
  assert.equal(characterUpdate.items[0]._id, 'legacyGear');
  assert.deepEqual(characterUpdate.items[0]['system.rollModifiers'], {
    0: { name: 'attribute.str', value: 1 },
  });
  assert.deepEqual(characterUpdate.items[0]['system.reliability'], { value: null, max: null });

  const unitUpdate = migrateActorData({
    type: 'unit',
    system: { unitModifiers: {} },
    _source: { system: { unitModifiers: { moutain: true } } },
    items: [],
  });
  assert.equal(unitUpdate['system.unitModifiers.mountain'], true);
  assert.ok(
    unitUpdate['system.unitModifiers.moutain'] instanceof foundry.data.operators.ForcedDeletion,
  );
});

test('Item migration converts legacy Weapon reliability, properties, ammo, and modifiers', async () => {
  installFoundryRuntime();
  const { migrateItemData } = await import('../src/system/migration.js');
  const update = migrateItemData({
    type: 'weapon',
    system: {
      mag: { value: 5 },
      modifiers: { skills: { rangedCombat: 2 } },
      props: { sight: true },
      reliability: { score: 'B', max: 'A' },
    },
  });

  assert.equal(update['system.reliability.value'], 4);
  assert.equal(update['system.reliability.max'], 5);
  assert.equal(update['system.mag.target'], '');
  assert.deepEqual(update['system.rollModifiers'], {
    0: { name: 'skill.rangedCombat', value: 2 },
  });
  assert.ok(update['system.props.sight'] instanceof foundry.data.operators.ForcedDeletion);
  assert.ok(update['system.mag.value'] instanceof foundry.data.operators.ForcedDeletion);
});

test('Scene migration handles linked, orphaned, and synthetic-token Actor data', async () => {
  installFoundryRuntime();
  game.actors.set('unitActor', { id: 'unitActor' });
  const { migrateSceneData } = await import('../src/system/migration.js');
  const token = data => ({
    actor: data.actor,
    toJSON: () => structuredClone(data.source),
  });
  const update = migrateSceneData({
    tokens: [
      token({ source: { _id: 'linked', actorId: 'unitActor', actorLink: true, delta: { old: true } } }),
      token({ source: { _id: 'orphan', actorId: 'missing', actorLink: false, delta: { old: true } } }),
      token({
        actor: { type: 'unit' },
        source: {
          _id: 'synthetic',
          actorId: 'unitActor',
          actorLink: false,
          delta: { system: { unitModifiers: { moutain: true } }, items: [] },
        },
      }),
    ],
  });

  assert.deepEqual(update.tokens[0].delta, {});
  assert.equal(update.tokens[1].actorId, null);
  assert.deepEqual(update.tokens[1].delta, {});
  assert.equal(update.tokens[2].delta['system.unitModifiers.mountain'], true);
  assert.ok(
    update.tokens[2].delta['system.unitModifiers.moutain']
      instanceof foundry.data.operators.ForcedDeletion,
  );
});

test('Compendium migration unlocks, migrates, updates, and relocks world packs', async () => {
  installFoundryRuntime();
  const { migrateCompendium } = await import('../src/system/migration.js');
  const lockStates = [];
  let migrated = false;
  let documentUpdate;
  const packDocument = {
    name: 'Legacy Gear',
    toObject: () => legacyGear(),
    async update(update) { documentUpdate = update; },
  };
  const pack = {
    collection: 'world.legacy-items',
    documentName: 'Item',
    locked: true,
    async configure({ locked }) { lockStates.push(locked); },
    async getDocuments() { return [packDocument]; },
    async migrate() { migrated = true; },
  };

  await migrateCompendium(pack);

  assert.equal(migrated, true);
  assert.deepEqual(lockStates, [false, true]);
  assert.deepEqual(documentUpdate['system.reliability'], { value: null, max: null });
});

test('Compendium migration restores the pack lock after a server migration failure', async () => {
  installFoundryRuntime();
  const { migrateCompendium } = await import('../src/system/migration.js');
  const lockStates = [];
  const pack = {
    collection: 'world.broken-items',
    documentName: 'Item',
    locked: true,
    async configure({ locked }) { lockStates.push(locked); },
    async migrate() { throw new Error('server migration failed'); },
  };

  await assert.rejects(migrateCompendium(pack), /server migration failed/);
  assert.deepEqual(lockStates, [false, true]);
});
