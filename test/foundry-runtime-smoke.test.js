import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { installFoundryRuntime } from './helpers/foundry-runtime.js';

test('Foundry startup, sheet, macro, combat, socket, and damage flow smoke test', async () => {
  const runtime = installFoundryRuntime();
  await import('../src/yzegs.js');
  await runtime.trigger('init');

  assert.equal(CONFIG.Actor.documentClass, game.yzegs.entities.ActorYZEGS);
  assert.equal(CONFIG.Item.documentClass, game.yzegs.entities.ItemYZEGS);
  assert.equal(typeof game.yzegs.roller.taskCheck, 'function');
  assert.deepEqual(Object.keys(CONFIG.Actor.dataModels).sort(), [
    'character', 'container', 'npc', 'party', 'unit', 'vehicle',
  ]);
  assert.deepEqual(Object.keys(CONFIG.Item.dataModels).sort(), [
    'ammunition', 'archetype', 'armor', 'disease', 'gear', 'grenade', 'injury', 'skill', 'specialty', 'weapon',
  ]);

  const characterRegistration = runtime.sheetRegistrations.find(entry => (
    entry.options.types?.includes('character')
  ));
  assert.ok(characterRegistration, 'the Character sheet should be registered during init');
  const sheet = new characterRegistration.sheetClass({ type: 'character' });
  const parts = sheet._configureRenderParts({});
  assert.equal(
    parts.sheet.template,
    'systems/fvtt-yze-generic-stepped/templates/actor/character/character-sheet.hbs',
  );
  await access(fileURLToPath(new URL(
    '../src/actor/character/character-sheet.hbs',
    import.meta.url,
  )));

  const { rollPush } = await import('../src/components/roll/dice.js');
  const { getEffectiveAttackSuccesses, resolveBlock } = await import('../src/system/defense.js');
  const { resolveDamageAllocation } = await import('../src/system/damage-allocation.js');
  const { findMacro } = await import('../src/system/macros.js');
  const pushedRoll = {
    options: {},
    pushable: true,
    duplicate() {
      return {
        options: {},
        pushed: true,
        attributeTrauma: 0,
        jamCount: 0,
        count: () => 0,
        async push() { this.baseSuccessQty = 3; },
        async toMessage() { return this; },
      };
    },
  };
  const attack = await rollPush(pushedRoll);
  assert.equal(attack.baseSuccessQty, 3);

  const block = resolveBlock({ attackSuccesses: attack.baseSuccessQty, blockSuccesses: 2 });
  attack.options.defense = { status: 'resolved', ...block };
  assert.equal(getEffectiveAttackSuccesses(attack), 1);

  const damage = resolveDamageAllocation({
    baseDamage: 2,
    baseSuccesses: getEffectiveAttackSuccesses(attack),
  });
  assert.equal(damage.damage, 2);
  assert.equal(damage.complete, true);

  const visibleMacro = {
    name: 'Knife',
    command: 'game.yzegs.macros.rollItem("second", "Knife");',
    author: game.user.id,
    ownership: { default: 0 },
  };
  game.macros.set('first', {
    ...visibleMacro,
    command: 'game.yzegs.macros.rollItem("first", "Knife");',
  });
  game.macros.set('second', visibleMacro);
  assert.equal(findMacro('Knife', visibleMacro.command), visibleMacro);

  await runtime.trigger('ready');
  assert.equal(runtime.socketHandlers.get('system.fvtt-yze-generic-stepped').length, 5);
  assert.equal(runtime.hooks.get('hotbarDrop').length, 1);

  await runtime.trigger('updateCombat', {
    id: 'smoke-combat',
    round: 1,
    turn: 0,
    combatants: [],
    combatant: null,
    getFlag: () => null,
  }, {}, {}, game.user.id);
});
