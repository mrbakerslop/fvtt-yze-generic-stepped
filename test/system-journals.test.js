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
const criticalInjuriesGuide = JSON.parse(
  readFileSync('content/journals/critical-injuries.json', 'utf8'),
);
const initiativeGuide = JSON.parse(
  readFileSync('content/journals/initiative-ambush-waylay.json', 'utf8'),
);
const closeCombatGuide = JSON.parse(
  readFileSync('content/journals/close-combat.json', 'utf8'),
);
const rangedCombatGuide = JSON.parse(
  readFileSync('content/journals/ranged-combat.json', 'utf8'),
);
const landVehiclesGuide = JSON.parse(
  readFileSync('content/journals/land-vehicles.json', 'utf8'),
);
const heavyWeaponsGuide = JSON.parse(
  readFileSync('content/journals/heavy-weapons-explosions.json', 'utf8'),
);
const diseaseGuide = JSON.parse(
  readFileSync('content/journals/diseases-and-conditions.json', 'utf8'),
);
const hazardGuide = JSON.parse(
  readFileSync('content/journals/environmental-hazards.json', 'utf8'),
);
const tacticalTerrainGuide = JSON.parse(
  readFileSync('content/journals/tactical-movement-and-terrain.json', 'utf8'),
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

test('the Critical Injuries guide documents injury, death-save, and stabilization automation', () => {
  assert.equal(criticalInjuriesGuide.entry.name, 'Using Critical Injuries and Death Saves');
  assert.equal(criticalInjuriesGuide.pages.length, 8);
  assertValidGuide(criticalInjuriesGuide);
  assert.match(criticalInjuriesGuide.pages[1].content, /final damage/);
  assert.match(criticalInjuriesGuide.pages[3].content, /Roll Death Save/);
  assert.match(criticalInjuriesGuide.pages[4].content, /Stabilized/);
  assert.match(criticalInjuriesGuide.pages[5].content, /Move wounded character/);
  assert.match(criticalInjuriesGuide.pages[6].content, /Killing Blow/);
  assert.doesNotMatch(JSON.stringify(criticalInjuriesGuide), /Twilight 2000/i);
});

test('the Initiative guide documents cards, surprise, ambushes, and waylays', () => {
  assert.equal(initiativeGuide.entry.name, 'Using Initiative, Ambushes, and Waylays');
  assert.equal(initiativeGuide.pages.length, 8);
  assertValidGuide(initiativeGuide);
  assert.match(initiativeGuide.pages[0].content, /shared deck of ten initiative cards/);
  assert.match(initiativeGuide.pages[2].content, /Full Surprise/);
  assert.match(initiativeGuide.pages[4].content, /Stalking Ambush/);
  assert.match(initiativeGuide.pages[5].content, /passive, unmodified detection/);
  assert.match(initiativeGuide.pages[6].content, /automatically gains \+3/);
  assert.doesNotMatch(JSON.stringify(initiativeGuide), /Twilight 2000/i);
});

test('the Close Combat guide documents automatic edges and staged defenses', () => {
  assert.equal(closeCombatGuide.entry.name, 'Using Close Combat');
  assert.equal(closeCombatGuide.pages.length, 8);
  assertValidGuide(closeCombatGuide);
  assert.match(closeCombatGuide.pages[1].content, /prone attacker receives an automatic −2/);
  assert.match(closeCombatGuide.pages[3].content, /Each Block success cancels one attack success/);
  assert.match(closeCombatGuide.pages[4].content, /Run<\/strong> earlier in the current combat round/);
  assert.match(closeCombatGuide.pages[6].content, /Break Free/);
  assert.doesNotMatch(JSON.stringify(closeCombatGuide), /Twilight 2000/i);
});

test('the Ranged Combat guide documents range, support, and friendly-fire edges', () => {
  assert.equal(rangedCombatGuide.entry.name, 'Using Ranged Combat');
  assert.equal(rangedCombatGuide.pages.length, 8);
  assertValidGuide(rangedCombatGuide);
  assert.match(rangedCombatGuide.pages[2].content, /up to eight times Range, −3/);
  assert.match(rangedCombatGuide.pages[3].content, /Medium: −1 damage/);
  assert.match(rangedCombatGuide.pages[5].content, /heavy machine gun must have a tripod or mounted property/);
  assert.match(rangedCombatGuide.pages[6].content, /Resolve Friendly Fire/);
  assert.doesNotMatch(JSON.stringify(rangedCombatGuide), /Twilight 2000/i);
});

test('the Land Vehicles guide documents setup and complete component damage', () => {
  assert.equal(landVehiclesGuide.entry.name, 'Using Land Vehicles');
  assert.equal(landVehiclesGuide.pages.length, 8);
  assertValidGuide(landVehiclesGuide);
  assert.match(landVehiclesGuide.pages[2].content, /Called Vehicle Component/);
  assert.match(landVehiclesGuide.pages[3].content, /Penetrating Cascades/);
  assert.match(landVehiclesGuide.pages[4].content, /Ammunition/);
  assert.match(landVehiclesGuide.pages[6].content, /Must bail out/);
  assert.match(landVehiclesGuide.pages[7].content, /Fuel Fire/);
  assert.doesNotMatch(JSON.stringify(landVehiclesGuide), /Twilight 2000/i);
});

test('the Heavy Weapons guide documents targeting, deviation, indirect fire, and explosions', () => {
  assert.equal(heavyWeaponsGuide.entry.name, 'Using Heavy Weapons and Explosions');
  assert.equal(heavyWeaponsGuide.pages.length, 9);
  assertValidGuide(heavyWeaponsGuide);
  assert.match(heavyWeaponsGuide.pages[1].content, /Indirect Fire Capable/);
  assert.match(heavyWeaponsGuide.pages[3].content, /Grid-space target/);
  assert.match(heavyWeaponsGuide.pages[4].content, /Resolve Deviation/);
  assert.match(heavyWeaponsGuide.pages[5].content, /maximum of \+3/);
  assert.match(heavyWeaponsGuide.pages[6].content, /2d12/);
  assert.match(heavyWeaponsGuide.pages[7].content, /forced suppression check/);
  assert.doesNotMatch(JSON.stringify(heavyWeaponsGuide), /Twilight 2000/i);
});

test('the Diseases guide documents reusable Items, progression, and survival conditions', () => {
  assert.equal(diseaseGuide.entry.name, 'Using Diseases and Survival Conditions');
  assert.equal(diseaseGuide.pages.length, 6);
  assertValidGuide(diseaseGuide);
  assert.match(diseaseGuide.pages[0].content, /Disease Items/);
  assert.match(diseaseGuide.pages[2].content, /Incubating/);
  assert.match(diseaseGuide.pages[4].content, /Sleep deprived/);
  assert.doesNotMatch(JSON.stringify(diseaseGuide), /Twilight 2000/i);
});

test('the Environmental Hazards guide documents Regions and exposure automation', () => {
  assert.equal(hazardGuide.entry.name, 'Using Environmental Hazards');
  assert.equal(hazardGuide.pages.length, 6);
  assertValidGuide(hazardGuide);
  assert.match(hazardGuide.pages[0].content, /Hazard Zone/);
  assert.match(hazardGuide.pages[1].content, /two stepped dice/);
  assert.match(hazardGuide.pages[2].content, /Disease Item UUID/);
  assert.match(hazardGuide.pages[3].content, /temporary radiation/);
  assert.doesNotMatch(JSON.stringify(hazardGuide), /Twilight 2000/i);
});

test('the Tactical Terrain guide documents opt-in movement and terrain assistance', () => {
  assert.equal(tacticalTerrainGuide.entry.name, 'Using Tactical Movement and Terrain');
  assert.equal(tacticalTerrainGuide.pages.length, 7);
  assertValidGuide(tacticalTerrainGuide);
  assert.match(tacticalTerrainGuide.pages[0].content, /disabled by default/);
  assert.match(tacticalTerrainGuide.pages[1].content, /Dense foliage/);
  assert.match(tacticalTerrainGuide.pages[3].content, /two spaces plus one for each success/);
  assert.match(tacticalTerrainGuide.pages[4].content, /Automatic Rules Modifiers/);
  assert.doesNotMatch(JSON.stringify(tacticalTerrainGuide), /Twilight 2000/i);
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
    criticalInjuriesGuide,
    initiativeGuide,
    closeCombatGuide,
    rangedCombatGuide,
    landVehiclesGuide,
    heavyWeaponsGuide,
    diseaseGuide,
    hazardGuide,
    tacticalTerrainGuide,
  ];
  const ids = guides.flatMap(guide => [
    guide.entry._id,
    ...guide.pages.map(page => page._id),
  ]);
  assert.equal(new Set(ids).size, ids.length);
});
