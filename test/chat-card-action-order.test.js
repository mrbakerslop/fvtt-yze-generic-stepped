import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROLL_TEMPLATE = fileURLToPath(
  new URL('../src/components/roll/templates/roll.hbs', import.meta.url),
);
const INFO_TEMPLATE = fileURLToPath(
  new URL('../src/components/roll/templates/infos.hbs', import.meta.url),
);

test('chat-card outcome controls precede the push-cost control', async () => {
  const [rollTemplate, infoTemplate] = await Promise.all([
    readFile(ROLL_TEMPLATE, 'utf8'),
    readFile(INFO_TEMPLATE, 'utf8'),
  ]);
  const pushCostsIndex = rollTemplate.indexOf('dice-button apply-push-costs');

  assert.ok(pushCostsIndex >= 0, 'the roll card should contain the push-cost control');
  assert.equal(
    infoTemplate.includes('dice-button apply-push-costs'),
    false,
    'the early roll-information block must not contain the push-cost control',
  );

  for (const control of [
    'resolve-critical-roll',
    'roll-block',
    'apply-block',
    'apply-action-outcome',
    'resolve-failed-retreat',
    'schedule-guided-impact',
    'evade-guided-impact',
    'apply-damage',
    'resolve-friendly-fire',
    'resolve-ricochet',
    'resolve-collapse',
    'resolve-deviation',
    'resolve-blast',
    'assign-suppression',
    'roll-suppression',
  ]) {
    const controlIndex = rollTemplate.indexOf(control);
    assert.ok(controlIndex >= 0, `the roll card should contain ${control}`);
    assert.ok(controlIndex < pushCostsIndex, `${control} should precede push costs`);
  }
});
