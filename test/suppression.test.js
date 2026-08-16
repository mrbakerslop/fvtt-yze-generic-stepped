import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceSuppressionTurn,
  applySuppressionStress,
  attackCausesSuppression,
  getEnclosingVehicle,
  queueSuppressionTurn,
  SUPPRESSION_PHASES,
} from '../src/system/suppression.js';

test('a hit or an ammo-die success on a miss causes suppression', () => {
  assert.equal(attackCausesSuppression({ attackSuccesses: 1, ammoSuccesses: 0 }), true);
  assert.equal(attackCausesSuppression({ attackSuccesses: 0, ammoSuccesses: 1 }), true);
  assert.equal(attackCausesSuppression({ attackSuccesses: 0, ammoSuccesses: 0 }), false);
});

test('suppression applies one Stress without reducing Stress Capacity below zero', () => {
  assert.equal(applySuppressionStress(4), 3);
  assert.equal(applySuppressionStress(0), 0);
});

test('fully enclosed vehicle occupants are protected but exposed occupants are not', () => {
  const actor = { id: 'crew' };
  const enclosedVehicle = {
    type: 'vehicle',
    system: { crew: { occupants: [{ id: 'crew', exposed: false }] } },
  };
  const exposedVehicle = {
    type: 'vehicle',
    system: { crew: { occupants: [{ id: 'crew', exposed: true }] } },
  };
  assert.equal(getEnclosingVehicle(actor, [enclosedVehicle])?.vehicle, enclosedVehicle);
  assert.equal(getEnclosingVehicle(actor, [exposedVehicle]), null);
});

test('a failed CUF check queues the action loss for the next combat turn', () => {
  const pending = queueSuppressionTurn(null, { combatId: 'combat' });
  assert.deepEqual(pending, {
    phase: SUPPRESSION_PHASES.PENDING,
    combatId: 'combat',
    queued: false,
  });
  assert.equal(advanceSuppressionTurn(pending, {
    combatId: 'combat', isActorTurn: false,
  }).effect, 'none');
  const active = advanceSuppressionTurn(pending, {
    combatId: 'combat', isActorTurn: true,
  });
  assert.equal(active.effect, 'activate');
  assert.equal(active.state.phase, SUPPRESSION_PHASES.ACTIVE);
  assert.deepEqual(advanceSuppressionTurn(active.state, {
    combatId: 'combat', isActorTurn: false,
  }), { effect: 'clear', state: null });
});

test('repeat suppression does not stack before the turn but can carry over during it', () => {
  const pending = queueSuppressionTurn(null, { combatId: 'combat' });
  assert.equal(queueSuppressionTurn(pending, { combatId: 'combat' }), pending);
  const active = advanceSuppressionTurn(pending, {
    combatId: 'combat', isActorTurn: true,
  }).state;
  const queued = queueSuppressionTurn(active, { combatId: 'combat' });
  assert.equal(queued.queued, true);
  assert.deepEqual(advanceSuppressionTurn(queued, {
    combatId: 'combat', isActorTurn: false,
  }).state, {
    phase: SUPPRESSION_PHASES.PENDING,
    combatId: 'combat',
    queued: false,
  });
});

test('out-of-combat suppression remains narrative instead of consuming action pools', () => {
  assert.deepEqual(queueSuppressionTurn(null), {
    phase: SUPPRESSION_PHASES.NARRATIVE,
    combatId: '',
    queued: false,
  });
});
