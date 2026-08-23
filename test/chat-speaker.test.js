import assert from 'node:assert/strict';
import test from 'node:test';

import { getRollSpeakerData } from '../src/components/roll/chat-speaker.js';

test('roll speaker remains tied to the Actor that made a staged roll', () => {
  assert.deepEqual(getRollSpeakerData({
    actorId: 'PLAYER',
    actorName: 'Player Character',
  }), {
    actor: 'PLAYER',
    alias: 'Player Character',
  });
});

test('roll speaker preserves synthetic Token references', () => {
  assert.deepEqual(getRollSpeakerData({
    actorId: 'NPC',
    actorName: 'Non-Player Character',
    sceneId: 'SCENE',
    tokenId: 'TOKEN',
  }), {
    scene: 'SCENE',
    actor: 'NPC',
    token: 'TOKEN',
    alias: 'Non-Player Character',
  });
});

test('roll speaker permits Foundry fallback when no roll owner was recorded', () => {
  assert.equal(getRollSpeakerData({}), null);
});
