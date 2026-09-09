/* global globalThis */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryRuntime } from './helpers/foundry-runtime.js';

import {
  canContainerStoreItemType,
  getContainerTransferPlan,
  isContainerTransfer,
  transferContainerItem,
  executeContainerTransferRequest,
  registerContainerTransfers,
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

let sequence = 0;

function transferFixture() {
  const runtime = installFoundryRuntime();
  game.user.active = true;
  game.users.set(game.user.id, game.user);
  foundry.utils.randomID = () => `transfer-${++sequence}`;
  const documents = new Map();
  globalThis.fromUuid = async uuid => documents.get(uuid);
  function inventory(type) {
    const actor = {
      uuid: `Actor.${type}`, type, name: type, isOwner: true, system: {}, items: new Map(),
      testUserPermission: user => user.id !== 'outsider',
      async createEmbeddedDocuments(_type, data) {
        return data.map(entry => {
          const created = makeItem(this, entry._id ?? `copy-${++sequence}`, entry.system);
          this.items.set(created.id, created);
          return created;
        });
      },
      async deleteEmbeddedDocuments(_type, ids) {
        const deleted = ids.map(id => this.items.get(id)).filter(Boolean);
        for (const id of ids) this.items.delete(id);
        return deleted;
      },
    };
    documents.set(actor.uuid, actor);
    return actor;
  }
  function makeItem(ownerActor, id, system) {
    return {
      id, parent: ownerActor, type: 'gear', name: 'Food', system: { ...system },
      toObject() { return { _id: this.id, type: this.type, system: { ...this.system } }; },
      async update(data) {
        for (const [key, value] of Object.entries(data)) foundry.utils.setProperty(this, key, value);
        return this;
      },
    };
  }
  const source = inventory('character');
  const destination = inventory('container');
  const item = makeItem(source, 'food', { qty: 6, equipped: true, backpack: true });
  source.items.set(item.id, item);
  const request = (overrides = {}) => ({
    sourceUuid: source.uuid, destinationUuid: destination.uuid, itemId: item.id,
    requesterId: game.user.id, requestId: foundry.utils.randomID(), quantity: 2,
    ...overrides,
  });
  const total = () => [...source.items.values(), ...destination.items.values()]
    .reduce((sum, entry) => sum + entry.system.qty, 0);
  return { source, destination, item, request, total, runtime };
}

test('full transfers preserve the ID and stack and clear carried state', async () => {
  const { source, destination, item, total } = transferFixture();
  const created = await transferContainerItem(item, destination, { quantity: 6 });
  assert.equal(created.id, item.id);
  assert.equal(created.system.qty, 6);
  assert.equal(created.system.equipped, false);
  assert.equal(created.system.backpack, false);
  assert.equal(source.items.size, 0);
  assert.equal(total(), 6);
});

test('overlapping transfers from two owners conserve quantity', async () => {
  const { item, request, total, destination } = transferFixture();
  game.users.set('owner2', { id: 'owner2', active: true, isGM: false });
  await Promise.all([
    executeContainerTransferRequest(request()),
    executeContainerTransferRequest(request({ requesterId: 'owner2' })),
  ]);
  assert.equal(item.system.qty, 2);
  assert.equal(destination.items.size, 2);
  assert.equal(total(), 6);
});

test('queued transfer rechecks a depleted source and duplicate requests are idempotent', async () => {
  const { request, total, destination } = transferFixture();
  const first = request({ quantity: 6 });
  const results = await Promise.allSettled([
    executeContainerTransferRequest(first),
    executeContainerTransferRequest(first),
    executeContainerTransferRequest(request()),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].value, results[0].value);
  assert.equal(results[2].status, 'rejected');
  assert.equal(destination.items.size, 1);
  assert.equal(total(), 6);
});

test('failed source updates roll back the destination and release the queue', async () => {
  const { request, total, destination, item } = transferFixture();
  const update = item.update;
  item.update = async () => { throw new Error('write failed'); };
  await assert.rejects(executeContainerTransferRequest(request()), /write failed/);
  assert.equal(destination.items.size, 0);
  assert.equal(total(), 6);
  item.update = update;
  await executeContainerTransferRequest(request());
  assert.equal(total(), 6);
  assert.equal(item.system.qty, 4);
});

test('a cancelled source deletion rolls back the destination', async () => {
  const { request, total, destination, source } = transferFixture();
  source.deleteEmbeddedDocuments = async () => [];
  await assert.rejects(executeContainerTransferRequest(request({ quantity: 6 })), /SourceMissing/);
  assert.equal(destination.items.size, 0);
  assert.equal(total(), 6);
});

test('the elected writer checks both requester permissions before moving anything', async () => {
  const { request, destination, total } = transferFixture();
  game.users.set('outsider', { id: 'outsider', active: true, isGM: false });
  await assert.rejects(executeContainerTransferRequest(request({ requesterId: 'outsider' })), /Permission/);
  assert.equal(destination.items.size, 0);
  assert.equal(total(), 6);
});

test('player transfers use authenticated document updates and wait for the elected GM', async () => {
  const { runtime, source, destination, item, total } = transferFixture();
  const gm = game.user;
  const player = { id: 'player', active: true, isGM: false };
  game.users.set(player.id, player);
  registerContainerTransfers();
  const handler = runtime.hooks.get('updateActor')[0].callback;
  const updates = [];
  const flags = {};
  source.getFlag = (_namespace, key) => foundry.utils.getProperty(flags, key);
  source.setFlag = async (_namespace, key, data) => {
    foundry.utils.setProperty(flags, key, data);
    const changes = {};
    foundry.utils.setProperty(changes, `flags.fvtt-yze-generic-stepped.${key}`, data);
    updates.push({ changes, userId: game.user.id, data });
  };
  // Defer cleanup to let this test deliver the response update to the simulated requesting client.
  source.unsetFlag = async () => true;
  game.user = player;
  const pending = transferContainerItem(item, destination, { quantity: 2 });
  assert.equal(updates.length, 1);
  assert.equal(destination.items.size, 0);
  game.user = gm;
  await handler(source, updates[0].changes, {}, updates[0].userId);
  assert.ok(updates[1].data.result.itemId);
  game.user = player;
  await handler(source, updates[1].changes, {}, updates[1].userId);
  assert.equal((await pending).system.qty, 2);
  assert.equal(total(), 6);
});

test('a transfer flag cannot impersonate a GM requester', async () => {
  const { runtime, source, destination, request } = transferFixture();
  registerContainerTransfers();
  const handler = runtime.hooks.get('updateActor')[0].callback;
  const forged = request();
  source.getFlag = () => forged;
  const changes = {};
  foundry.utils.setProperty(changes,
    `flags.fvtt-yze-generic-stepped.containerTransferRequests.${forged.requestId}`, forged);
  await handler(source, changes, {}, 'outsider');
  assert.equal(destination.items.size, 0);
});

test('without a GM all owners still elect one source owner to perform transfers', async () => {
  const { request, total, destination } = transferFixture();
  const first = { id: 'owner-a', active: true, isGM: false };
  const second = { id: 'owner-b', active: true, isGM: false };
  game.users.clear();
  game.users.set(second.id, second);
  game.users.set(first.id, first);
  const operation = request({ requesterId: second.id });
  game.user = second;
  assert.equal(await executeContainerTransferRequest(operation), null);
  assert.equal(destination.items.size, 0);
  game.user = first;
  assert.equal((await executeContainerTransferRequest(operation)).system.qty, 2);
  assert.equal(total(), 6);
});

test('destination creation failures leave source quantity untouched', async () => {
  const { request, item, destination, total } = transferFixture();
  destination.createEmbeddedDocuments = async () => { throw new Error('create failed'); };
  await assert.rejects(executeContainerTransferRequest(request()), /create failed/);
  assert.equal(item.system.qty, 6);
  assert.equal(total(), 6);
});
