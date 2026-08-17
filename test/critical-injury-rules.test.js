import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CRITICAL_TIME_SECONDS,
  criticalSeverityDice,
  nextStabilizationStage,
  normalizeTimeLimit,
} from '../src/system/critical-injury-rules.js';

test('critical severity uses final damage and adds a die for each two points over Critical', () => {
  assert.equal(criticalSeverityDice(3, 4), 0);
  assert.equal(criticalSeverityDice(4, 4), 1);
  assert.equal(criticalSeverityDice(5, 4), 1);
  assert.equal(criticalSeverityDice(6, 4), 2);
  assert.equal(criticalSeverityDice(8, 4), 3);
});

test('lethal time limits normalize and stabilization advances one stage', () => {
  assert.equal(normalizeTimeLimit('Round'), 'round');
  assert.equal(normalizeTimeLimit('one Stretch'), 'stretch');
  assert.equal(normalizeTimeLimit('Shift'), 'shift');
  assert.equal(nextStabilizationStage('round'), 'stretch');
  assert.equal(nextStabilizationStage('stretch'), 'shift');
  assert.equal(nextStabilizationStage('shift'), 'stabilized');
  assert.deepEqual(CRITICAL_TIME_SECONDS, { round: 10, stretch: 600, shift: 21600 });
});
