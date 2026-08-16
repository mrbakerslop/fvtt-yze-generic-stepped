import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySceneGridPresetSource,
  getSceneGridPreset,
  getSceneMode,
  isConfinedSpaceScene,
  isCityTravelScene,
  isCloseQuartersScene,
  SCENE_GRID_PRESET_IDS,
  TWILIGHT_HEX_GRID_TYPE,
} from '../src/system/scene-grid.js';

test('Twilight close-quarters Scenes use approximate flat-top 2.5 metre hexes', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS), {
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 2.5,
    units: 'm',
  });
});

test('Twilight battle Scenes use flat-top 10 metre hexes', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.BATTLE), {
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 10,
    units: 'm',
  });
});

test('Twilight city Scenes use flat-top 200 metre hexes', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.CITY), {
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 200,
    units: 'm',
  });
});

test('Twilight travel Scenes use flat-top 10 kilometre hexes', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.TRAVEL), {
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 10,
    units: 'km',
  });
});

test('System Default leaves the pending Scene grid unchanged', () => {
  assert.equal(getSceneGridPreset(SCENE_GRID_PRESET_IDS.SYSTEM), null);
  let update = null;
  const scene = { updateSource: value => { update = value; } };
  assert.equal(applySceneGridPresetSource(scene, SCENE_GRID_PRESET_IDS.SYSTEM), false);
  assert.equal(update, null);
});

test('applying a preset changes the grid and records its rules mode', () => {
  let update = null;
  const scene = { updateSource: value => { update = value; } };
  assert.equal(applySceneGridPresetSource(scene, SCENE_GRID_PRESET_IDS.BATTLE), true);
  assert.deepEqual(update, {
    grid: { type: TWILIGHT_HEX_GRID_TYPE, distance: 10, units: 'm' },
    flags: {
      'fvtt-yze-generic-stepped': {
        sceneMode: SCENE_GRID_PRESET_IDS.BATTLE,
        urbanOperations: false,
      },
    },
  });
  assert.equal(Object.hasOwn(update.grid, 'size'), false);
  assert.equal(Object.hasOwn(update.grid, 'offsetX'), false);
  assert.equal(Object.hasOwn(update.grid, 'offsetY'), false);
});

test('Scene modes prefer an explicit flag and infer legacy preset scales', () => {
  const explicit = {
    flags: { 'fvtt-yze-generic-stepped': { sceneMode: SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS } },
    grid: { distance: 200, units: 'm' },
  };
  assert.equal(getSceneMode(explicit), SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS);
  assert.equal(isCloseQuartersScene(explicit), true);
  const legacy = { grid: { distance: 200, units: 'm' } };
  assert.equal(getSceneMode(legacy), SCENE_GRID_PRESET_IDS.CITY);
  assert.equal(isCityTravelScene(legacy), true);
});

test('confined-space hazards are enabled only by the explicit Scene flag', () => {
  assert.equal(isConfinedSpaceScene({
    flags: { 'fvtt-yze-generic-stepped': { confinedSpace: true } },
  }), true);
  assert.equal(isConfinedSpaceScene({ flags: {} }), false);
});
