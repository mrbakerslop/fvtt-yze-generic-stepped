import assert from 'node:assert/strict';
import test from 'node:test';

import { getLegacySkillKey } from '../src/system/legacy-skills.js';

test('legacy Skill keys resolve from migration flags and canonical IDs', () => {
  const flagged = {
    id: 'customSkillId',
    type: 'skill',
    getFlag: () => 'medicalAid',
  };
  const canonical = { id: 'skillMobility000', type: 'skill' };
  assert.equal(getLegacySkillKey(flagged), 'medicalAid');
  assert.equal(getLegacySkillKey(canonical), 'mobility');
  assert.equal(getLegacySkillKey({ id: 'custom', type: 'skill' }), '');
});
