import { YZEGS } from './config.js';

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

  const sourceItem = sourceActor.items.get(item.id);
  if (!sourceItem) {
    ui.notifications.warn(game.i18n.localize('YZEGS.ContainerSheet.Errors.SourceMissing'));
    return null;
  }
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
    if (plan.isFull) await sourceActor.deleteEmbeddedDocuments('Item', [sourceItem.id]);
    else await sourceItem.update({ 'system.qty': plan.remaining });
  }
  catch (error) {
    if (createdItem && destinationActor.items.has(createdItem.id)) {
      await destinationActor.deleteEmbeddedDocuments('Item', [createdItem.id]);
    }
    throw error;
  }

  ui.notifications.info(game.i18n.format('YZEGS.ContainerSheet.ItemMoved', {
    quantity: plan.quantity,
    item: sourceItem.name,
    source: sourceActor.name,
    destination: destinationActor.name,
  }));
  return createdItem;
}
