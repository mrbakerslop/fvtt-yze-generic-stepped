import assert from 'node:assert/strict';
import test from 'node:test';

import { targetInFiringArc } from '../src/system/water-rules.js';

const source = { center: { x: 0, y: 0 }, rotation: 0 };

test('guided firing arcs follow token rotation', () => {
  assert.equal(targetInFiringArc(source, { center: { x: 0, y: -10 } }, 'front'), true);
  assert.equal(targetInFiringArc(source, { center: { x: 10, y: 0 } }, 'starboard'), true);
  assert.equal(targetInFiringArc(source, { center: { x: 0, y: 10 } }, 'rear'), true);
  assert.equal(targetInFiringArc(source, { center: { x: -10, y: 0 } }, 'port'), true);
  assert.equal(targetInFiringArc(source, { center: { x: -10, y: 0 } }, 'front'), false);
});

test('all-arcs weapons do not need token geometry', () => {
  assert.equal(targetInFiringArc(null, null, 'all'), true);
});
