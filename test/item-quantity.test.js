import assert from 'node:assert/strict';
import test from 'node:test';

import { usesItemQuantity } from '../src/system/item-quantity.js';

test('magazines and belts hide quantity while ammunition boxes remain stackable', () => {
  assert.equal(usesItemQuantity('ammunition', { props: { magazine: true } }), false);
  assert.equal(usesItemQuantity('ammunition', { props: { magazine: false, ammoBelt: true } }), false);
  assert.equal(usesItemQuantity('ammunition', {
    props: { magazine: false, ammoBelt: false, ammoBox: true },
  }), true);
  assert.equal(usesItemQuantity('ammunition', { props: { magazine: false } }), true);
  assert.equal(usesItemQuantity('gear', { props: {} }), true);
});
