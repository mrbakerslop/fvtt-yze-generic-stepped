import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENGAGED_STATUS_ICON,
  HUGGING_WALL_STATUS_ICON,
  getStatusIconUpdate,
} from '../src/system/statusEffects.js';

test('legacy Close Quarters Engaged icon paths are repaired', () => {
  for (const img of ['icons/svg/swords.svg', 'icons/svg/sworlds.svg']) {
    assert.deepEqual(getStatusIconUpdate({
      id: 'effect-id',
      img,
      statuses: new Set(['engaged']),
    }), {
      _id: 'effect-id',
      img: ENGAGED_STATUS_ICON,
    });
  }
});

test('legacy Hugging Wall icon paths are repaired', () => {
  assert.deepEqual(getStatusIconUpdate({
    id: 'wall-effect',
    img: 'icons/svg/brick-wall.svg',
    statuses: new Set(['huggingWall']),
  }), {
    _id: 'wall-effect',
    img: HUGGING_WALL_STATUS_ICON,
  });
});

test('valid and unrelated status icons are not changed', () => {
  assert.equal(getStatusIconUpdate({
    id: 'valid-effect',
    img: ENGAGED_STATUS_ICON,
    statuses: new Set(['engaged']),
  }), null);
  assert.equal(getStatusIconUpdate({
    id: 'other-effect',
    img: 'icons/svg/swords.svg',
    statuses: new Set(['prone']),
  }), null);
});
