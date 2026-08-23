import assert from 'node:assert/strict';
import test from 'node:test';

import { getActorTokenUuid } from '../src/system/defense-workflows.js';

test('staged defenses preserve the synthetic Actor Token reference', () => {
  assert.equal(getActorTokenUuid({ token: { uuid: 'Scene.SCENE.Token.NPC' } }), 'Scene.SCENE.Token.NPC');
  assert.equal(getActorTokenUuid({
    token: { document: { uuid: 'Scene.SCENE.Token.PLAYER' } },
  }), 'Scene.SCENE.Token.PLAYER');
  assert.equal(getActorTokenUuid({}), '');
});
