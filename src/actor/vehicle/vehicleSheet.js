import ActorSheetYZEGS from '../actorSheet.js';
import { YZEGS } from '../../system/config.js';
import { runWatercraftSheetAction } from '../../system/watercraft-workflows.js';

/**
 * Year Zero Engine - Generic Stepped Dice Actor Sheet for Vehicles.
 * @extends {ActorSheetYZEGS} Extends the YZEGS ActorSheet
 */
export default class ActorSheetYZEGSVehicle extends ActorSheetYZEGS {
  /* ------------------------------------------- */
  /*  Sheet Properties                           */
  /* ------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['vehicle'],
    position: { width: 650, height: 715 },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: 'crew' },
        { id: 'components' },
        { id: 'combat' },
        { id: 'cargo' },
        { id: 'description' },
      ],
      initial: 'crew',
    },
  };

  /* ------------------------------------------- */
  /*  Sheet Data Preparation                     */
  /* ------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const sheetData = await super._prepareContext(options);

    if (this.actor.type === 'vehicle') {
      this._prepareCrew(sheetData);
      this._prepareMountedWeapons(sheetData);
      sheetData.inVehicle = true;
      sheetData.isWatercraft = ['watercraft', 'amphibious'].includes(sheetData.system.domain);
      sheetData.isLargeWatercraft = sheetData.isWatercraft && Number(sheetData.system.watercraft?.size) >= 2;
      sheetData.isLandVehicle = sheetData.system.domain === 'land';
    }

    return sheetData;
  }

  /* ------------------------------------------- */

  _prepareCrew(sheetData) {
    sheetData.crew = sheetData.system.crew.occupants.reduce((arr, o) => {
      o.actor = game.actors.get(o.id);
      // Creates a fake actor if it doesn't exist anymore in the database.
      if (!o.actor) {
        o.actor = {
          name: '{MISSING_CREW}',
          data: { data: { health: { value: 0, max: 0 } } },
          isCrewDeleted: true,
        };
      }
      else {
        o.bailOutRequired = Boolean(o.actor.getFlag(
          'fvtt-yze-generic-stepped', 'vehicleBailOut',
        )?.required);
      }
      arr.push(o);
      return arr;
    }, []);
    sheetData.crew.sort((o1, o2) => {
      const pos1 = YZEGS.vehicle.crewPositionFlags.indexOf(o1.position);
      const pos2 = YZEGS.vehicle.crewPositionFlags.indexOf(o2.position);
      if (pos1 < pos2) return -1;
      if (pos1 > pos2) return 1;
      // If they are at the same position, sort by their actor's names.
      if (o1.actor.name < o2.actor.name) return -1;
      if (o1.actor.name > o2.actor.name) return 1;
      return 0;
    });
    return sheetData;
  }

  /* ------------------------------------------- */

  _prepareMountedWeapons(sheetData) {
    const m = (i, slot) => i.type === 'weapon' && i.system.isMounted && i.system.mountSlot === slot;

    sheetData.mountedWeapons = {
      primary: sheetData.actor.items.filter(i => m(i, 1)).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
      secondary: sheetData.actor.items.filter(i => m(i, 2)).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    };
    return sheetData;
  }

  /* ------------------------------------------- */
  /*  Crew Management                            */
  /* ------------------------------------------- */

  dropCrew(actorId) {
    const crew = game.actors.get(actorId);
    if (!crew) return;
    if (crew.type === 'vehicle') return ui.notifications.info('Vehicle inceptions are not allowed!');
    if (crew.type !== 'character' && crew.type !== 'npc') return;
    return this.actor.addVehicleOccupant(actorId);
  }

  /** @override */
  async _onDropActor(_event, actor) {
    await this.dropCrew(actor.id);
    return actor;
  }

  /* ------------------------------------------- */
  /*  Sheet Listeners                            */
  /* ------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    // Everything below here is only needed if the sheet is editable.
    if (!this.isEditable) return;

    // Owner-only listeners.
    if (this.actor.isOwner) {
      // Crew
      html.find('.crew-edit').click(this._onCrewEdit.bind(this));
      html.find('.crew-remove').click(this._onCrewRemove.bind(this));
      html.find('.crew-expose').change(this._onExposeCrew.bind(this));
      html.find('.crew-position').change(this._onChangePosition.bind(this));
      // Items
      html.find('.item-mount').click(this._onWeaponMount.bind(this));
      html.find('.item-mount-move').click(this._onWeaponMountMove.bind(this));
      html.find('.watercraft-action').click(this._onWatercraftAction.bind(this));
    }
  }

  async _onWatercraftAction(event) {
    event.preventDefault();
    await runWatercraftSheetAction(this.actor, event.currentTarget.dataset.action);
    this.render(true);
  }

  /* ------------------------------------------- */

  /**
   * @param {Event} event
   * @private
   */
  _onCrewEdit(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const crewId = elem.closest('.occupant').dataset.crewId;
    const actor = game.actors.get(crewId);
    return actor.sheet.render(true);
  }

  _onCrewRemove(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const crewId = elem.closest('.occupant').dataset.crewId;
    const occupants = this.actor.removeVehicleOccupant(crewId);
    return this.actor.update({ 'system.crew.occupants': occupants });
  }

  _onExposeCrew(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const crewId = elem.closest('.occupant').dataset.crewId;
    const position = this.actor.getVehicleOccupant(crewId)?.position;
    const exposed = elem.checked;
    return this.actor.addVehicleOccupant(crewId, position, exposed);
  }

  _onChangePosition(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const crewId = elem.closest('.occupant').dataset.crewId;
    const position = elem.value;
    const exposed = this.actor.getVehicleOccupant(crewId)?.exposed;
    return this.actor.addVehicleOccupant(crewId, position, exposed);
  }

  /* ------------------------------------------- */

  _onWeaponMount(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (item.system.isMounted) {
      return item.update({ 'system.equipped': false });
    }
    else {
      return item.update({
        'system.equipped': true,
        'system.props.mounted': true,
        'system.mountSlot': 1,
      });
    }
  }

  _onWeaponMountMove(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const itemId = elem.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);
    let slot = item.system.mountSlot;

    if (slot > 1) slot--;
    else slot++;

    return item.update({ 'system.mountSlot': slot });
  }
}
