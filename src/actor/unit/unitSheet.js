import ActorSheetYZEGS from '../actorSheet.js';

/**
 * Year Zero Engine - Generic Stepped Dice Actor Sheet for Units.
 * @extends {ActorSheetYZEGS} Extends the YZEGS ActorSheet
 */
export default class ActorSheetYZEGSUnit extends ActorSheetYZEGS {
  /* ------------------------------------------- */
  /*  Sheet Properties                           */
  /* ------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['unit'],
    position: { width: 400, height: 550 },
  };

  static TABS = {
    primary: {
      tabs: [{ id: 'features' }, { id: 'description' }],
      initial: 'features',
    },
  };

  /* ------------------------------------------- */
  /*  Sheet Data Preparation                     */
  /* ------------------------------------------- */

  // /** @override */
  // getData() {
  //   const sheetData = super.getData();
  //   return sheetData;
  // }

  /* ------------------------------------------- */

  /* ------------------------------------------- */
  /*  Sheet Listeners                            */
  /* ------------------------------------------- */

  // /** @override */
  // activateListeners(html) {
  //   super.activateListeners(html);

  //   // Everything below here is only needed if the sheet is editable.
  //   if (!this.options.editable) return;
  //   if (!this.isEditable) return;

  //   // Owner-only listeners.
  //   if (this.actor.isOwner) {}
  // }

  /* ------------------------------------------- */
}
