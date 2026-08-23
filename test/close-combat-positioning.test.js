import assert from 'node:assert/strict';
import test from 'node:test';

import { isCloseCombatPositionAllowed } from '../src/system/close-combat-positioning.js';

test('close combat requires a shared grid space by default but can be unrestricted', () => {
  assert.equal(isCloseCombatPositionAllowed(false), true);
  assert.equal(isCloseCombatPositionAllowed(true), false);
  assert.equal(isCloseCombatPositionAllowed(true, false), true);
});
