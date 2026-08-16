/* global globalThis */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canContainerStoreItemType,
  getContainerTransferPlan,
  isContainerTransfer,
  transferContainerItem,
} from '../src/system/container-transfer.js';

test('container storage settings are container-specific and default to allowing physical Items', () => {
  const unrestricted = { type: 'container', system: {} };
  const weaponRack = {
    type: 'container',
    system: { allowedItemTypes: { weapon: true, armor: false } },
  };

  assert.equal(canContainerStoreItemType(unrestricted, 'armor'), true);
  assert.equal(canContainerStoreItemType(weaponRack, 'weapon'), true);
  assert.equal(canContainerStoreItemType(weaponRack, 'armor'), false);
  assert.equal(canContainerStoreItemType(weaponRack, 'skill'), false);
  assert.equal(canContainerStoreItemType({ type: 'character', system: {} }, 'weapon'), false);
});

test('container transfers are recognized in both directions', () => {
  const character = { type: 'character' };
  const container = { type: 'container' };

  assert.equal(isContainerTransfer(character, container), true);
  assert.equal(isContainerTransfer(container, character), true);
});

test('container transfers reject unsupported and identical actors', () => {
  const character = { type: 'character' };
  const otherCharacter = { type: 'character' };
  const container = { type: 'container' };
  const vehicle = { type: 'vehicle' };

  assert.equal(isContainerTransfer(character, otherCharacter), false);
  assert.equal(isContainerTransfer(container, vehicle), false);
  assert.equal(isContainerTransfer(container, container), false);
  assert.equal(isContainerTransfer(null, character), false);
});

test('transfer quantities are clamped and report the remaining stack', () => {
  assert.deepEqual(getContainerTransferPlan(6, 2), {
    available: 6,
    quantity: 2,
    remaining: 4,
    isFull: false,
  });
  assert.deepEqual(getContainerTransferPlan(6, 20), {
    available: 6,
    quantity: 6,
    remaining: 0,
    isFull: true,
  });
});

test('a Character cannot transfer a disabled Item type into a Container', async () => {
  const originalUi = globalThis.ui;
  const originalGame = globalThis.game;
  let warning;

  try {
    globalThis.ui = { notifications: { warn: message => { warning = message; } } };
    globalThis.game = {
      i18n: {
        format: key => key,
        localize: key => key,
      },
    };
    const source = { type: 'character' };
    const destination = {
      type: 'container',
      name: 'Weapon Rack',
      system: { allowedItemTypes: { gear: false } },
    };
    const item = { type: 'gear', parent: source };

    assert.equal(await transferContainerItem(item, destination, { quantity: 1 }), null);
    assert.equal(warning, 'YZEGS.ContainerSheet.Errors.ItemTypeNotAllowed');
  }
  finally {
    globalThis.ui = originalUi;
    globalThis.game = originalGame;
  }
});

test('moving an item into a container preserves its stack and clears carried state', async () => {
  const originalUi = globalThis.ui;
  const originalGame = globalThis.game;
  const originalFoundry = globalThis.foundry;
  let createdData;
  let deletedId;

  try {
    globalThis.ui = { notifications: { info: () => null, warn: () => null } };
    globalThis.game = {
      i18n: {
        format: key => key,
        localize: key => key,
      },
    };
    globalThis.foundry = {
      utils: {
        setProperty(object, path, value) {
          const parts = path.split('.');
          const final = parts.pop();
          const target = parts.reduce((current, part) => current[part], object);
          target[final] = value;
        },
      },
    };

    const sourceItems = new Map();
    const destinationItems = new Map();
    const source = {
      type: 'character',
      name: 'Character',
      isOwner: true,
      items: sourceItems,
      async deleteEmbeddedDocuments(_type, ids) {
        [deletedId] = ids;
        sourceItems.delete(deletedId);
      },
    };
    const destination = {
      type: 'container',
      name: 'Crate',
      isOwner: true,
      items: destinationItems,
      async createEmbeddedDocuments(_type, [data]) {
        createdData = data;
        const created = { id: data._id };
        destinationItems.set(created.id, created);
        return [created];
      },
      async deleteEmbeddedDocuments() {
        return [];
      },
    };
    const item = {
      id: 'item-id',
      name: 'Rifle ammunition',
      type: 'ammunition',
      parent: source,
      system: { qty: 6 },
      toObject: () => ({
        _id: 'item-id',
        system: { qty: 6, equipped: true, backpack: true },
      }),
    };
    sourceItems.set(item.id, item);

    const result = await transferContainerItem(item, destination, { quantity: 6 });

    assert.equal(result.id, item.id);
    assert.equal(deletedId, item.id);
    assert.equal(createdData.system.qty, 6);
    assert.equal(createdData.system.equipped, false);
    assert.equal(createdData.system.backpack, false);

    let remainingQuantity;
    const partialItem = {
      id: 'partial-item-id',
      name: 'Food',
      type: 'gear',
      parent: source,
      system: { qty: 6 },
      toObject: () => ({
        _id: 'partial-item-id',
        system: { qty: 6, equipped: false, backpack: false },
      }),
      async update(data) {
        remainingQuantity = data['system.qty'];
      },
    };
    sourceItems.set(partialItem.id, partialItem);

    await transferContainerItem(partialItem, destination, { quantity: 2 });

    assert.equal(createdData._id, undefined);
    assert.equal(createdData.system.qty, 2);
    assert.equal(remainingQuantity, 4);
    assert.equal(sourceItems.has(partialItem.id), true);
  }
  finally {
    globalThis.ui = originalUi;
    globalThis.game = originalGame;
    globalThis.foundry = originalFoundry;
  }
});
