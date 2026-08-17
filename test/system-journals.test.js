import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync('static/system.json', 'utf8'));
const socialGuide = JSON.parse(
  readFileSync('content/journals/social-conflict-automation.json', 'utf8'),
);
const minefieldGuide = JSON.parse(
  readFileSync('content/journals/minefield-automation.json', 'utf8'),
);
const confinedSpaceGuide = JSON.parse(
  readFileSync('content/journals/confined-space-automation.json', 'utf8'),
);
const internalReloadGuide = JSON.parse(
  readFileSync('content/journals/internal-magazine-reloading.json', 'utf8'),
);
const automatedOutcomesGuide = JSON.parse(
  readFileSync('content/journals/automated-combat-outcomes.json', 'utf8'),
);
const sceneGridGuide = JSON.parse(
  readFileSync('content/journals/scene-grid-presets.json', 'utf8'),
);
const travelModesGuide = JSON.parse(
  readFileSync('content/journals/travel-modes.json', 'utf8'),
);

function assertValidGuide(guide) {
  assert.equal(guide.entry._id.length, 16);
  assert.equal(new Set(guide.pages.map(page => page._id)).size, guide.pages.length);
  assert.ok(guide.pages.every(page => page._id.length === 16));
  assert.deepEqual(
    guide.pages.map(page => page.sort),
    [...guide.pages.map(page => page.sort)].sort((left, right) => left - right),
  );
}

test('the system manifest exposes the Journal guide compendium', () => {
  const pack = manifest.packs.find(entry => entry.name === 'system-journals');
  assert.equal(pack?.type, 'JournalEntry');
  assert.equal(pack?.path, 'packs/system-journals');
  assert.equal(pack?.ownership?.PLAYER, 'OBSERVER');
});

test('the Social Conflict guide contains ordered, valid Journal pages', () => {
  assert.equal(socialGuide.entry.name, 'Using Social Conflict Automation');
  assert.equal(socialGuide.pages.length, 8);
  assertValidGuide(socialGuide);
  assert.match(socialGuide.pages[0].content, /Persuade/);
  assert.match(socialGuide.pages[3].content, /Ties always favour the resisting side/);
  assert.doesNotMatch(JSON.stringify(socialGuide), /Twilight 2000/i);
});

test('the Minefield guide documents setup and resolution in valid Journal pages', () => {
  assert.equal(minefieldGuide.entry.name, 'Setting Up and Using Minefields');
  assert.equal(minefieldGuide.pages.length, 8);
  assertValidGuide(minefieldGuide);
  assert.match(minefieldGuide.pages[0].content, /Minefield Region Behavior/);
  assert.match(minefieldGuide.pages[4].content, /Affected Hexes and Entrants/);
  assert.match(minefieldGuide.pages[5].content, /Resolve Blast Against Selected Tokens/);
  assert.match(minefieldGuide.pages[6].content, /Water Minefields/);
  assert.doesNotMatch(JSON.stringify(minefieldGuide), /Twilight 2000/i);
});

test('the Confined Space guide documents Scene hazards in valid Journal pages', () => {
  assert.equal(confinedSpaceGuide.entry.name, 'Running Underground and Confined Spaces');
  assert.equal(confinedSpaceGuide.pages.length, 8);
  assertValidGuide(confinedSpaceGuide);
  assert.match(confinedSpaceGuide.pages[1].content, /Enable confined-space hazards on this Scene/);
  assert.match(confinedSpaceGuide.pages[3].content, /Resolve Ricochet/);
  assert.match(confinedSpaceGuide.pages[4].content, /Pinned by Debris/);
  assert.match(confinedSpaceGuide.pages[5].content, /Break free from debris/);
  assert.doesNotMatch(JSON.stringify(confinedSpaceGuide), /Twilight 2000/i);
});

test('the Internal Magazine guide documents both world reload modes', () => {
  assert.equal(internalReloadGuide.entry.name, 'Using Internal Magazine Reloading');
  assert.equal(internalReloadGuide.pages.length, 6);
  assertValidGuide(internalReloadGuide);
  assert.match(internalReloadGuide.pages[0].content, /Internal Magazine Reloading/);
  assert.match(internalReloadGuide.pages[2].content, /Full Reload \(Rules as Written\)/);
  assert.match(internalReloadGuide.pages[3].content, /Load One Round per Action/);
  assert.match(internalReloadGuide.pages[4].content, /Switching Ammunition Types/);
  assert.doesNotMatch(JSON.stringify(internalReloadGuide), /Twilight 2000/i);
});

test('the Automated Combat Outcomes guide documents persistent states and applied results', () => {
  assert.equal(automatedOutcomesGuide.entry.name, 'Using Automated Combat States and Outcomes');
  assert.equal(automatedOutcomesGuide.pages.length, 10);
  assertValidGuide(automatedOutcomesGuide);
  assert.match(automatedOutcomesGuide.pages[0].content, /Immediate and Rolled Automation/);
  assert.match(automatedOutcomesGuide.pages[2].content, /Partial and Full Cover/);
  assert.match(automatedOutcomesGuide.pages[6].content, /Shove and Disarm/);
  assert.match(automatedOutcomesGuide.pages[7].content, /Grapple and Break Free/);
  assert.match(automatedOutcomesGuide.pages[8].content, /First Aid and Rally/);
  assert.match(automatedOutcomesGuide.pages[9].content, /Extinguishing Fire/);
  assert.doesNotMatch(JSON.stringify(automatedOutcomesGuide), /Twilight 2000/i);
});

test('the Scene Grid Presets guide documents scale, rules modes, and token defaults', () => {
  assert.equal(sceneGridGuide.entry.name, 'Using Scene Grid Presets');
  assert.equal(sceneGridGuide.pages.length, 8);
  assertValidGuide(sceneGridGuide);
  assert.match(sceneGridGuide.pages[0].content, /Default Scene Grid/);
  assert.match(sceneGridGuide.pages[3].content, /10 km/);
  assert.match(sceneGridGuide.pages[4].content, /confined-space hazards/);
  assert.match(sceneGridGuide.pages[7].content, /Default Prototype Token Sizes/);
  assert.doesNotMatch(JSON.stringify(sceneGridGuide), /Twilight 2000/i);
});

test('the Travel Modes guide documents Standard, Urban, and Water travel', () => {
  assert.equal(travelModesGuide.entry.name, 'Using Travel Modes');
  assert.equal(travelModesGuide.pages.length, 8);
  assertValidGuide(travelModesGuide);
  assert.match(travelModesGuide.pages[0].content, /Standard Travel/);
  assert.match(travelModesGuide.pages[3].content, /Advance City Stretch/);
  assert.match(travelModesGuide.pages[4].content, /Open Water/);
  assert.match(travelModesGuide.pages[5].content, /Advance Water Shift/);
  assert.match(travelModesGuide.pages[6].content, /Action Skills/);
  assert.doesNotMatch(JSON.stringify(travelModesGuide), /Twilight 2000/i);
});

test('all System Guide document ids are unique', () => {
  const guides = [
    socialGuide,
    minefieldGuide,
    confinedSpaceGuide,
    internalReloadGuide,
    automatedOutcomesGuide,
    sceneGridGuide,
    travelModesGuide,
  ];
  const ids = guides.flatMap(guide => [
    guide.entry._id,
    ...guide.pages.map(page => page._id),
  ]);
  assert.equal(new Set(ids).size, ids.length);
});
