import assert from 'node:assert/strict';
import test from 'node:test';

import { buildItemMacroCommand, resolveActorMacroItem } from '../src/system/macro-rules.js';

function actorWith(items) {
  return {
    items: {
      get: id => items.find(item => item.id === id),
      filter: predicate => items.filter(predicate),
    },
  };
}

test('new Item macros safely encode the embedded id and fallback name', () => {
  assert.equal(
    buildItemMacroCommand({ id: 'item-id', name: 'Scout\'s "Rifle"' }),
    'game.yzegs.macros.rollItem("item-id", "Scout\'s \\"Rifle\\"");',
  );
});

test('new Item macros prefer the original embedded Item id', () => {
  const intended = { id: 'second', name: 'Knife' };
  const result = resolveActorMacroItem(actorWith([
    { id: 'first', name: 'Knife' },
    intended,
  ]), 'second', 'Knife');

  assert.equal(result.item, intended);
  assert.equal(result.matches.length, 1);
});

test('new Item macros fall back by name on another Actor', () => {
  const intended = { id: 'other-id', name: 'Knife' };
  const result = resolveActorMacroItem(actorWith([intended]), 'missing-id', 'Knife');

  assert.equal(result.item, intended);
});

test('ambiguous legacy or fallback Item names do not select an arbitrary Item', () => {
  const items = [{ id: 'first', name: 'Knife' }, { id: 'second', name: 'Knife' }];
  const result = resolveActorMacroItem(actorWith(items), 'Knife');

  assert.equal(result.item, null);
  assert.deepEqual(result.matches, items);
});
