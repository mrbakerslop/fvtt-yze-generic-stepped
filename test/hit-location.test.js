import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHitLocationLocalizationKey,
  normalizeHitLocationResult,
  normalizeHitLocationResults,
} from '../src/components/roll/hit-location.js';

test('hit locations retain numeric die results', () => {
  assert.equal(normalizeHitLocationResult(1), 1);
  assert.equal(normalizeHitLocationResult('6'), 6);
  assert.deepEqual(normalizeHitLocationResults([1, 4, 6]), [1, 4, 6]);
});

test('pushed hit-location labels normalize to numeric faces', () => {
  assert.equal(normalizeHitLocationResult('L'), 1);
  assert.equal(normalizeHitLocationResult('T'), 2);
  assert.equal(normalizeHitLocationResult('A'), 5);
  assert.equal(normalizeHitLocationResult('H'), 6);
  assert.deepEqual(normalizeHitLocationResults(['T']), [2]);
});

test('custom labels and invalid results are handled safely', () => {
  const labels = { 1: 'Legs', 2: 'Torso', 5: 'Arms', 6: 'Head' };
  assert.equal(normalizeHitLocationResult('head', labels), 6);
  assert.deepEqual(normalizeHitLocationResults(['Torso', 'unknown'], labels), [2]);
});

test('rolled and selected hit locations resolve to valid translation keys', () => {
  assert.equal(getHitLocationLocalizationKey(6), 'YZUR.CHAT.ROLL.Locations.6');
  assert.equal(getHitLocationLocalizationKey('H'), 'YZUR.CHAT.ROLL.Locations.6');
  assert.equal(getHitLocationLocalizationKey('head'), 'YZEGS.ArmorLocationNames.head');
  assert.equal(getHitLocationLocalizationKey('torso'), 'YZEGS.ArmorLocationNames.torso');
  assert.equal(getHitLocationLocalizationKey('unknown'), '');
});
