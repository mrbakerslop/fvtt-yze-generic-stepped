import assert from 'node:assert/strict';
import test from 'node:test';

import {
  availableInitiativeCards,
  chooseInitiativeCard,
  compareInitiativeCards,
  drawInitiativeCandidates,
  getAmbushRangeModifier,
  getWaylaySetupModifier,
  resolveAmbush,
  topInitiativeCards,
} from '../src/system/initiative-rules.js';

test('initiative cards are unique and the lowest drawn card is retained', () => {
  assert.deepEqual(availableInitiativeCards([1, 4, 9]), [2, 3, 5, 6, 7, 8, 10]);
  const cards = drawInitiativeCandidates([1, 2, 3, 4], 3, () => 0);
  assert.deepEqual(cards, [1, 2, 3]);
  assert.equal(chooseInitiativeCard([7, 2, 5]), 2);
});

test('combatants act from the lowest card to the highest with unresolved entries last', () => {
  const combatants = [
    { name: 'Unresolved', initiative: null },
    { name: 'Late', initiative: 9 },
    { name: 'Early', initiative: 2 },
  ];
  assert.deepEqual(combatants.sort(compareInitiativeCards).map(entry => entry.name), [
    'Early', 'Late', 'Unresolved',
  ]);
});

test('ambush ties favour the target and range modifiers follow the table', () => {
  assert.equal(resolveAmbush({ attackerSuccesses: 2, targetSuccesses: 2 }).success, false);
  assert.equal(resolveAmbush({ attackerSuccesses: 3, targetSuccesses: 2 }).success, true);
  assert.equal(getAmbushRangeModifier('same'), -2);
  assert.equal(getAmbushRangeModifier('twentyOnePlus'), 2);
});

test('waylay preparation and group initiative use the configured bonuses and top cards', () => {
  assert.equal(getWaylaySetupModifier('action'), 0);
  assert.equal(getWaylaySetupModifier('stretch'), 2);
  assert.equal(getWaylaySetupModifier('shift'), 3);
  assert.deepEqual(topInitiativeCards(4), [1, 2, 3, 4]);
});
