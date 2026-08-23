import assert from 'node:assert/strict';
import test from 'node:test';

import { YZEGS } from '../src/system/config.js';

test('roll dialog message modes use the Foundry v14 localization keys', () => {
  assert.deepEqual(YZEGS.messageModes, {
    public: 'CHAT.MODES.public',
    gm: 'CHAT.MODES.gm',
    blind: 'CHAT.MODES.blind',
    self: 'CHAT.MODES.self',
  });
});
