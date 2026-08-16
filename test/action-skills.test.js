import assert from 'node:assert/strict';
import test from 'node:test';

let mappings = {};

global.foundry = {
  utils: {
    deepClone: value => structuredClone(value),
  },
};

global.game = {
  i18n: {
    lang: 'en',
    localize: key => key,
  },
  settings: {
    get: () => mappings,
  },
};

const {
  getActionSkillReference,
  skillMatchesAction,
} = await import('../src/system/action-skills.js');

function skill({ id = 'embedded', displayName = 'Skill', legacyKey = '', sourceId = '' } = {}) {
  return {
    id,
    uuid: `Actor.actor.Item.${id}`,
    name: displayName,
    type: 'skill',
    getFlag: (scope, key) => {
      if (scope === 'fvtt-yze-generic-stepped' && key === 'legacySkillKey') return legacyKey;
      if (scope === 'core' && key === 'sourceId') return sourceId;
      return undefined;
    },
  };
}

test('unconfigured actions retain their legacy Skill mapping', () => {
  mappings = {};
  assert.equal(getActionSkillReference('run').legacyKey, 'mobility');
  assert.equal(skillMatchesAction(skill({ legacyKey: 'mobility' }), 'run'), true);
  assert.equal(skillMatchesAction(skill({ legacyKey: 'stamina' }), 'run'), false);
});

test('configured actions match copied Skills by source UUID or name', () => {
  mappings = {
    run: { uuid: 'Compendium.world.skills.Item.parkour', name: 'Parkour' },
  };
  assert.equal(skillMatchesAction(skill({
    displayName: 'Parkour',
    sourceId: 'Compendium.world.skills.Item.parkour',
  }), 'run'), true);
  assert.equal(skillMatchesAction(skill({ displayName: 'parkour' }), 'run'), true);
  assert.equal(skillMatchesAction(skill({ displayName: 'Mobility', legacyKey: 'mobility' }), 'run'), false);
});
