import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collapseOccurs,
  countRicochets,
  getCollapseDieSize,
  getConfinedBlastRating,
  getRicochetShotCount,
  isRicochetEligibleWeapon,
} from '../src/system/confined-space.js';

test('confined-space blast increases one step before the collapse check', () => {
  assert.equal(getConfinedBlastRating('D'), 'C');
  assert.equal(getConfinedBlastRating('A'), 'A');
  assert.equal(getCollapseDieSize('C'), 8);
  assert.equal(getCollapseDieSize('–'), 0);
  assert.equal(collapseOccurs(1), false);
  assert.equal(collapseOccurs(2), true);
});

test('ricochets roll once per shot and trigger on results of one', () => {
  assert.equal(getRicochetShotCount(0), 1);
  assert.equal(getRicochetShotCount(7), 7);
  assert.equal(countRicochets([1, 5, 1, 10]), 2);
});

test('ordinary firearms can ricochet but shotguns and explosive weapons cannot', () => {
  assert.equal(isRicochetEligibleWeapon({ system: { ammo: '9x19', blast: '–', props: {} } }), true);
  assert.equal(isRicochetEligibleWeapon({ system: { ammo: '12GA', blast: '–', props: { shotgun: true } } }), false);
  assert.equal(isRicochetEligibleWeapon({ system: { ammo: '40mm', blast: 'D', props: {} } }), false);
});
