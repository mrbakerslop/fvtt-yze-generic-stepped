import assert from 'node:assert/strict';
import test from 'node:test';

import { installFoundryRuntime } from './helpers/foundry-runtime.js';

test('addDice awaits new results and applies modifiers only to those results', async () => {
  installFoundryRuntime();
  const { YearZeroRoll } = await import('../src/lib/yzur.js');
  const existingResult = { active: true, indexPush: 1, indexResult: 4, result: 2 };
  const term = {
    faces: 6,
    number: 1,
    options: {},
    pushCount: 1,
    results: [existingResult],
    type: 'skill',
    async roll(options) {
      await Promise.resolve();
      const result = { active: true, result: 3, ...options };
      this.results.push(result);
      return result;
    },
    async _evaluateModifiers() {
      for (const result of this.results) {
        result.modifierSawValue = result.result;
        result.modified = true;
      }
    },
  };
  const roll = {
    _evaluated: true,
    _evaluateTotal: () => 0,
    constructor: { getFormula: () => '2ds' },
    getTerms: () => [term],
    terms: [term],
  };

  await YearZeroRoll.prototype.addDice.call(roll, 1, 'skill', { value: 6 });

  assert.equal(term.number, 2);
  assert.equal(term.results.length, 2);
  assert.equal(existingResult.modified, undefined);
  assert.deepEqual(term.results[1], {
    active: true,
    indexPush: 1,
    indexResult: 5,
    modifierSawValue: 6,
    modified: true,
    result: 6,
  });
});

test('addDice restores existing results when modifier evaluation fails', async () => {
  installFoundryRuntime();
  const { YearZeroRoll } = await import('../src/lib/yzur.js');
  const existingResult = { active: true, result: 4 };
  const term = {
    faces: 6,
    number: 1,
    options: {},
    pushCount: 0,
    results: [existingResult],
    type: 'skill',
    async roll() {
      const result = { active: true, result: 3 };
      this.results.push(result);
      return result;
    },
    async _evaluateModifiers() {
      throw new Error('modifier failure');
    },
  };
  const roll = {
    _evaluated: true,
    constructor: { getFormula: () => '1ds' },
    getTerms: () => [term],
    terms: [term],
  };

  await assert.rejects(
    YearZeroRoll.prototype.addDice.call(roll, 1, 'skill'),
    /modifier failure/,
  );
  assert.equal(term.number, 1);
  assert.equal(term.results[0], existingResult);
  assert.equal(term.results.length, 1);
});
