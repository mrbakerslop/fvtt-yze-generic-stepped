import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canChooseAttributeRating,
  getAttributeAllocationCost,
  getCapacityValues,
  linesFromText,
  parseRankOptions,
  validateAttributeAllocation,
  validateSkillAllocation,
} from '../src/system/archetype-rules.js';

test('attribute allocation accepts both standard legal patterns', () => {
  assert.deepEqual(validateAttributeAllocation({ str: 'A', agl: 'B', int: 'C', emp: 'C' }), []);
  assert.deepEqual(validateAttributeAllocation({ str: 'A', agl: 'A', int: 'C', emp: 'D' }), []);
});

test('attribute allocation rejects overspending and multiple reductions', () => {
  assert.ok(validateAttributeAllocation({ str: 'A', agl: 'B', int: 'B', emp: 'C' }).length);
  assert.ok(validateAttributeAllocation({ str: 'A', agl: 'A', int: 'D', emp: 'D' }).length);
  assert.ok(validateAttributeAllocation({ str: 'F', agl: 'A', int: 'C', emp: 'C' }).length);
});

test('attribute choice limits enforce the increase budget and one optional reduction', () => {
  const baseline = { str: 'C', agl: 'C', int: 'C', emp: 'C' };
  assert.equal(getAttributeAllocationCost(baseline), 0);
  assert.equal(canChooseAttributeRating(baseline, 'str', 'A'), true);

  const spent = { str: 'A', agl: 'B', int: 'C', emp: 'C' };
  assert.equal(getAttributeAllocationCost(spent), 3);
  assert.equal(canChooseAttributeRating(spent, 'int', 'B'), false);
  assert.equal(canChooseAttributeRating(spent, 'int', 'D'), true);

  const traded = { str: 'A', agl: 'B', int: 'D', emp: 'C' };
  assert.equal(canChooseAttributeRating(traded, 'emp', 'B'), true);
  assert.equal(canChooseAttributeRating(traded, 'emp', 'D'), false);
});

test('skill allocation requires the exact budget, unique skills, and a key B skill', () => {
  const valid = { heavy: 'B', stamina: 'C', ranged: 'C', driving: 'D', mobility: 'D', recon: 'D' };
  assert.deepEqual(validateSkillAllocation(valid, ['heavy', 'tech']), []);
  assert.ok(validateSkillAllocation({ ...valid, heavy: 'C' }, ['heavy']).length);
  assert.ok(validateSkillAllocation(valid, ['tech']).length);
  const missing = { '': 'B', stamina: 'C', ranged: 'C', driving: 'D', mobility: 'D', recon: 'D' };
  assert.ok(validateSkillAllocation(missing, ['']).length);
});

test('rank option parser ignores malformed rows and supports single results', () => {
  assert.deepEqual(parseRankOptions('1-2 | Private\n3 | Corporal\nwrong\n6-4 | Invalid'), [
    { min: 1, max: 2, label: 'Private' },
    { min: 3, max: 3, label: 'Corporal' },
  ]);
});

test('line parsing and capacity calculations are deterministic', () => {
  assert.deepEqual(linesFromText(' Alpha \n\nBeta\n'), ['Alpha', 'Beta']);
  assert.deepEqual(getCapacityValues({ str: 'A', agl: 'A', int: 'C', emp: 'D' }), {
    health: 6,
    sanity: 4,
  });
});
