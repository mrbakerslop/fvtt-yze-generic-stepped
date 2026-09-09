import { YZEGS } from './config.js';
import { getPrimaryActiveGM } from './active-gm.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';
const TRANSFER_FLAG = 'containerTransferRequests';
const transferQueues = new Map();
const transferRequests = new Map();
const activeTransferRequests = new Set();
const pendingTransfers = new Map();

/**
 * Test whether a drag represents a supported Character/Container transfer.
 * @param {Actor|null} sourceActor Source Actor
 * @param {Actor|null} destinationActor Destination Actor
 * @returns {boolean}
 */
export function isContainerTransfer(sourceActor, destinationActor) {
  if (!sourceActor || !destinationActor || sourceActor === destinationActor) return false;
  return [sourceActor.type, destinationActor.type].sort().join(':') === 'character:container';
}

/**
 * Test whether a Container accepts an Item type. Missing settings are treated as
 * enabled so Containers created before the storage settings were added remain usable.
 * @param {Actor} containerActor Container Actor
 * @param {string} itemType Item document type
 * @returns {boolean}
 */
export function canContainerStoreItemType(containerActor, itemType) {
  if (containerActor?.type !== 'container' || !YZEGS.physicalItems.includes(itemType)) return false;
  return containerActor.system?.allowedItemTypes?.[itemType] !== false;
}

/**
 * Normalize a requested transfer quantity against the available stack.
 * @param {number} sourceQuantity Available quantity
 * @param {number|undefined} requestedQuantity Requested quantity, or all when omitted
 * @returns {{available: number, quantity: number, remaining: number, isFull: boolean}}
 */
export function getContainerTransferPlan(sourceQuantity, requestedQuantity) {
  const available = Math.max(1, Math.trunc(Number(sourceQuantity) || 1));
  const requested = Math.max(1, Math.trunc(Number(requestedQuantity) || available));
  const quantity = Math.min(available, requested);
  const remaining = available - quantity;
  return { available, quantity, remaining, isFull: remaining === 0 };
}

async function chooseTransferQuantity(item, destinationActor, available) {
  if (available <= 1) return 1;
  const promptText = game.i18n.format('YZEGS.ContainerSheet.TransferPrompt', {
    item: item.name,
    source: item.parent.name,
    destination: destinationActor.name,
  });
  const result = await foundry.applications.api.DialogV2.input({
    classes: ['yzegs', 'container-transfer-dialog'],
    window: { title: game.i18n.localize('YZEGS.ContainerSheet.TransferTitle') },
    position: { width: 420 },
    content: `
      <p>${foundry.utils.escapeHTML(promptText)}</p>
      <div class="form-group">
        <label>${game.i18n.localize('YZEGS.ItemSheet.Quantity')}</label>
        <div class="form-fields">
          <input type="number" name="quantity" value="${available}" min="1" max="${available}" step="1" autofocus>
        </div>
      </div>
    `,
    ok: { label: game.i18n.localize('YZEGS.ContainerSheet.Move') },
    buttons: [{
      action: 'cancel',
      label: game.i18n.localize('YZEGS.Dialog.Actions.Cancel'),
      type: 'button',
      callback: () => null,
    }],
    rejectClose: false,
  });
  if (!result) return null;
  return getContainerTransferPlan(available, result.quantity).quantity;
}

/**
 * Move an embedded physical Item between a Character and Container.
 * The destination is created first and removed again if deleting the source fails.
 * @param {Item} item Embedded Item being moved
 * @param {Actor} destinationActor Destination Actor
 * @param {object} [options] Transfer options
 * @param {number} [options.quantity] Quantity to move; prompts when omitted for stacks
 * @returns {Promise<Item|null>}
 */
export async function transferContainerItem(item, destinationActor, { quantity } = {}) {
  const sourceActor = item?.parent;
  if (!isContainerTransfer(sourceActor, destinationActor)) return null;

  if (!YZEGS.physicalItems.includes(item.type)) {
    ui.notifications.warn(game.i18n.localize('YZEGS.ContainerSheet.Errors.PhysicalItemsOnly'));
    return null;
  }
  if (destinationActor.type === 'container' && !canContainerStoreItemType(destinationActor, item.type)) {
    ui.notifications.warn(game.i18n.format('YZEGS.ContainerSheet.Errors.ItemTypeNotAllowed', {
      type: game.i18n.localize(`YZEGS.ItemTypes.${item.type}`),
      container: destinationActor.name,
    }));
    return null;
  }
  if (!sourceActor.isOwner || !destinationActor.isOwner) {
    ui.notifications.warn(game.i18n.localize('YZEGS.ContainerSheet.Errors.Permission'));
    return null;
  }
  if (!sourceActor.items.has(item.id)) {
    ui.notifications.warn(game.i18n.localize('YZEGS.ContainerSheet.Errors.SourceMissing'));
    return null;
  }

  const initialPlan = getContainerTransferPlan(item.system.qty, quantity);
  if (quantity === undefined) {
    quantity = await chooseTransferQuantity(item, destinationActor, initialPlan.available);
    if (quantity === null) return null;
  }

  const authority = getTransferAuthority(sourceActor);
  if (!authority) throw transferError('NoAuthority');
  const request = {
    requestId: foundry.utils.randomID(),
    requesterId: game.user.id,
    authorityId: authority.id,
    sourceUuid: sourceActor.uuid,
    destinationUuid: destinationActor.uuid,
    itemId: item.id,
    quantity,
  };
  const createdItem = authority.id === game.user.id
    ? await executeContainerTransferRequest(request)
    : await requestRemoteTransfer(request, sourceActor, destinationActor);
  if (!createdItem) return null;
  ui.notifications.info(game.i18n.format('YZEGS.ContainerSheet.ItemMoved', {
    quantity: createdItem.system.qty,
    item: item.name,
    source: sourceActor.name,
    destination: destinationActor.name,
  }));
  return createdItem;
}

function transferError(key) {
  return new Error(game.i18n.localize(`YZEGS.ContainerSheet.Errors.${key}`));
}

function ownsActor(user, actor) {
  return Boolean(user && actor && (user.isGM
    || actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)));
}

/** Election depends only on the source, so different destinations cannot use different queues. */
function getTransferAuthority(sourceActor) {
  return getPrimaryActiveGM() ?? game.users.filter(user => user.active && ownsActor(user, sourceActor))
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
}

/** Execute on the elected client; revalidate ownership and quantities inside the source queue. */
export async function executeContainerTransferRequest(request) {
  const sourceActor = await fromUuid(request.sourceUuid);
  if (!sourceActor || getTransferAuthority(sourceActor)?.id !== game.user.id) return null;
  const requestKey = `${request.requesterId}:${request.requestId}`;
  if (transferRequests.has(requestKey)) return transferRequests.get(requestKey);
  const queueKey = `${request.sourceUuid}.Item.${request.itemId}`;
  const previous = transferQueues.get(queueKey) ?? Promise.resolve();
  const operation = previous.catch(() => null).then(async () => {
    // Do not continue queued work after responsibility has moved to another client.
    if (getTransferAuthority(sourceActor)?.id !== game.user.id) throw transferError('NoAuthority');
    const destinationActor = await fromUuid(request.destinationUuid);
    const requester = game.users.get(request.requesterId);
    if (!ownsActor(requester, sourceActor) || !ownsActor(requester, destinationActor)
      || !ownsActor(game.user, destinationActor)) throw transferError('Permission');
    if (!isContainerTransfer(sourceActor, destinationActor)) throw transferError('TransferFailed');
    const sourceItem = sourceActor.items.get(request.itemId);
    if (!sourceItem || !(Number(sourceItem.system.qty) > 0)) throw transferError('SourceMissing');
    if (!YZEGS.physicalItems.includes(sourceItem.type)) throw transferError('PhysicalItemsOnly');
    if (destinationActor.type === 'container' && !canContainerStoreItemType(destinationActor, sourceItem.type)) {
      throw transferError('TransferFailed');
    }
    if (!Number.isSafeInteger(request.quantity) || request.quantity <= 0) throw transferError('TransferFailed');
    return moveContainerItem(sourceItem, destinationActor, request.quantity);
  });
  transferQueues.set(queueKey, operation);
  transferRequests.set(requestKey, operation);
  activeTransferRequests.add(requestKey);
  try {
    return await operation;
  }
  finally {
    activeTransferRequests.delete(requestKey);
    if (transferQueues.get(queueKey) === operation) transferQueues.delete(queueKey);
    // Keep recent completed responses for duplicate requests, without evicting active work.
    if (transferRequests.size > 256) {
      for (const key of transferRequests.keys()) {
        if (!activeTransferRequests.has(key)) transferRequests.delete(key);
        if (transferRequests.size <= 256) break;
      }
    }
  }
}

async function moveContainerItem(sourceItem, destinationActor, quantity) {
  const sourceActor = sourceItem.parent;
  const plan = getContainerTransferPlan(sourceItem.system.qty, quantity);
  const itemData = sourceItem.toObject();
  foundry.utils.setProperty(itemData, 'system.qty', plan.quantity);
  const keepId = plan.isFull && !destinationActor.items.has(sourceItem.id);
  if (!keepId) delete itemData._id;
  if (destinationActor.type === 'container') {
    foundry.utils.setProperty(itemData, 'system.equipped', false);
    foundry.utils.setProperty(itemData, 'system.backpack', false);
  }

  let createdItem;
  try {
    [createdItem] = await destinationActor.createEmbeddedDocuments('Item', [itemData], { keepId });
    if (!createdItem) throw transferError('TransferFailed');
    if (plan.isFull) {
      const deleted = await sourceActor.deleteEmbeddedDocuments('Item', [sourceItem.id]);
      if (!deleted.length) throw transferError('SourceMissing');
    }
    else {
      const updated = await sourceItem.update({ 'system.qty': plan.remaining });
      if (!updated) throw transferError('TransferFailed');
    }
  }
  catch (error) {
    if (createdItem && destinationActor.items.has(createdItem.id)) {
      await destinationActor.deleteEmbeddedDocuments('Item', [createdItem.id]);
    }
    throw error;
  }
  return createdItem;
}

function requestRemoteTransfer(request, sourceActor, destinationActor) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingTransfers.delete(request.requestId);
      // Do not retry an uncertain write automatically: the elected client may have completed it.
      reject(transferError('TransferTimeout'));
    }, 30000);
    pendingTransfers.set(request.requestId, { resolve, reject, timeout, destinationActor, request });
    sourceActor.setFlag(SYSTEM_ID, `${TRANSFER_FLAG}.${request.requestId}`, request).catch(error => {
      pendingTransfers.delete(request.requestId);
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/** Use document hooks' server-supplied userId, never a socket payload's claimed identity. */
export function registerContainerTransfers() {
  Hooks.on('updateActor', async (sourceActor, changes, _options, userId) => {
    const requests = foundry.utils.getProperty(changes, `flags.${SYSTEM_ID}.${TRANSFER_FLAG}`);
    if (!requests) return;
    for (const requestId of Object.keys(requests)) {
      const request = sourceActor.getFlag(SYSTEM_ID, `${TRANSFER_FLAG}.${requestId}`);
      if (!request || request.requestId !== requestId || request.sourceUuid !== sourceActor.uuid) continue;
      if (request.result) {
        const pending = pendingTransfers.get(requestId);
        if (!pending || userId !== pending.request.authorityId || request.requesterId !== game.user.id) continue;
        pendingTransfers.delete(requestId);
        clearTimeout(pending.timeout);
        if (request.result.error) pending.reject(new Error(request.result.error));
        else pending.resolve(pending.destinationActor.items.get(request.result.itemId) ?? null);
        continue;
      }
      if (getTransferAuthority(sourceActor)?.id !== game.user.id) continue;
      // An owner cannot impersonate another owner (or a GM) by changing requesterId in the flag.
      if (request.requesterId !== userId) continue;
      let result;
      try {
        const item = await executeContainerTransferRequest(request);
        if (!item) throw transferError('TransferFailed');
        result = { itemId: item.id };
      }
      catch (error) {
        console.error('yzegs | Container transfer failed.', error);
        result = { error: error.message };
      }
      try {
        await sourceActor.setFlag(SYSTEM_ID, `${TRANSFER_FLAG}.${requestId}`, { ...request, result });
        await sourceActor.unsetFlag(SYSTEM_ID, `${TRANSFER_FLAG}.${requestId}`);
      }
      catch (error) {
        console.error('yzegs | Container transfer confirmation failed.', error);
      }
    }
  });
}
