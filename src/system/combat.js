import { compareInitiativeCards } from './initiative-rules.js';

/** Combat document using card initiative, where the lowest card acts first. */
export default class CombatYZEGS extends Combat {
  /** @override */
  _sortCombatants(left, right) {
    return compareInitiativeCards(left, right);
  }
}
