import ActorSheetYZEGS from '../actorSheet.js';
import { usesItemQuantity } from '../../system/item-quantity.js';

export default class ActorSheetYZEGSContainer extends ActorSheetYZEGS {
  static DEFAULT_OPTIONS = {
    classes: ['container'],
    position: { width: 620, height: 560 },
  };

  static TABS = {
    primary: {
      tabs: [{ id: 'inventory' }, { id: 'description' }, { id: 'settings' }],
      initial: 'inventory',
    },
  };

  async _prepareContext(options) {
    const sheetData = await super._prepareContext(options);
    const inventoryTypeOrder = ['weapon', 'armor', 'gear', 'ammunition', 'grenade'];
    const toContainerItem = item => ({
      id: item.id,
      img: item.img,
      name: item.name,
      quantity: item.system.qty,
      usesQuantity: usesItemQuantity(item.type, item.system),
      encumbrance: item.system.encumbrance,
    });
    const items = inventoryTypeOrder.flatMap(type => this.actor.itemTypes[type] ?? []);

    sheetData.containerItemGroups = inventoryTypeOrder
      .map(type => ({
        type,
        label: game.i18n.localize(`YZEGS.ItemTypes.${type}`),
        items: [...(this.actor.itemTypes[type] ?? [])]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(toContainerItem),
      }))
      .filter(group => group.items.length);
    sheetData.isGM = game.user.isGM;
    sheetData.containerStorageTypes = inventoryTypeOrder.map(type => ({
      type,
      label: game.i18n.localize(`YZEGS.ItemTypes.${type}`),
      path: `system.allowedItemTypes.${type}`,
      allowed: this.actor.system.allowedItemTypes?.[type] !== false,
    }));
    const totalWeight = items.reduce((total, item) => total + (Number(item.system.encumbrance) || 0), 0);
    sheetData.containerTotalWeight = Number(totalWeight.toFixed(2));
    return sheetData;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.isEditable) return;
    this.element.querySelectorAll('.container-item-quantity').forEach(input => {
      input.addEventListener('change', this._onQuantityChange.bind(this));
    });
  }

  _onQuantityChange(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return null;
    const quantity = Math.max(1, Math.trunc(Number(event.currentTarget.value) || 1));
    return item.update({ 'system.qty': quantity });
  }
}
