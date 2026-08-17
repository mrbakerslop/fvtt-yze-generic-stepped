import assert from 'node:assert/strict';
import test from 'node:test';

import {
  diseaseBlocksRecovery,
  diseaseCheckModifier,
  fireDieFaces,
  getDiseaseOutcome,
  hazardDurationSeconds,
  increaseFireIntensity,
  steppedDieSuccesses,
} from '../src/system/disease-rules.js';

function disease(overrides = {}) {
  return {
    type: 'disease',
    system: {
      virulence: -2,
      state: { phase: 'active', antibioticsUsed: true },
      treatment: { antibioticsEffective: true, antibioticsModifier: 3 },
      recovery: { blocksDamage: true, blocksStress: false },
      ...overrides,
    },
  };
}

test('hazard durations use the configured world-time unit', () => {
  assert.equal(hazardDurationSeconds(2, 'round'), 12);
  assert.equal(hazardDurationSeconds(1, 'stretch'), 600);
  assert.equal(hazardDurationSeconds(1, 'shift'), 21600);
  assert.equal(hazardDurationSeconds(1, 'day'), 86400);
});

test('medicine modifies checks only when effective and administered', () => {
  assert.equal(diseaseCheckModifier(disease()), 1);
  assert.equal(diseaseCheckModifier(disease({
    state: { phase: 'active', antibioticsUsed: false },
  })), -2);
  assert.equal(diseaseCheckModifier(disease({
    treatment: { antibioticsEffective: false, antibioticsModifier: 3 },
  })), -2);
});

test('active disease recovery restrictions are track specific', () => {
  assert.equal(diseaseBlocksRecovery(disease(), 'damage'), true);
  assert.equal(diseaseBlocksRecovery(disease(), 'stress'), false);
  assert.equal(diseaseBlocksRecovery(disease({
    state: { phase: 'recovered', antibioticsUsed: false },
  }), 'damage'), false);
});

test('a successful disease check recovers and a failure progresses', () => {
  assert.deepEqual(getDiseaseOutcome({ phase: 'incubating', successes: 1 }), {
    recovered: true,
    nextPhase: 'recovered',
  });
  assert.deepEqual(getDiseaseOutcome({ phase: 'incubating', successes: 0 }), {
    recovered: false,
    nextPhase: 'active',
    newlyActive: true,
  });
});

test('fire intensity and stepped successes follow stepped-die progression', () => {
  assert.deepEqual(['D', 'C', 'B', 'A'].map(fireDieFaces), [6, 8, 10, 12]);
  assert.deepEqual(['D', 'C', 'B', 'A'].map(increaseFireIntensity), ['C', 'B', 'A', 'A']);
  assert.equal(steppedDieSuccesses(5, 12), 0);
  assert.equal(steppedDieSuccesses(8, 8), 2);
  assert.equal(steppedDieSuccesses(10, 10), 2);
  assert.equal(steppedDieSuccesses(12, 12), 3);
});
