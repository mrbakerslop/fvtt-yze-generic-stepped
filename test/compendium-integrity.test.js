import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyActorPackKeys,
  inspectActorPack,
} from '../tools/compendium-integrity.js';

test('actor pack key classification identifies embedded records without parents', () => {
  const audit = classifyActorPackKeys([
    '!actors!actor-one',
    '!actors.items!actor-one.item-one',
    '!actors.items!missing-actor.item-two',
    '!folders!folder-one',
  ]);

  assert.equal(audit.actors, 1);
  assert.equal(audit.embedded, 2);
  assert.equal(audit.linked, 1);
  assert.deepEqual(audit.orphanedKeys, ['!actors.items!missing-actor.item-two']);
});

test('bundled actor compendium contains only linked embedded records', async () => {
  const audit = await inspectActorPack();

  assert.ok(audit.actors > 0);
  assert.ok(audit.embedded > 0);
  assert.deepEqual(audit.orphanedKeys, []);
});
