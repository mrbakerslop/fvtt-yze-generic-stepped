import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySceneGridPresetSource,
  getSceneGridPreset,
  getSceneMode,
  isConfinedSpaceScene,
  isCityTravelScene,
  isCloseQuartersScene,
  FLAT_TOP_HEX_GRID_TYPE,
  SCENE_GRID_PRESET_IDS,
  SQUARE_GRID_TYPE,
} from '../src/system/scene-grid.js';

test('close-quarters Scenes support 2.5 metre hex and square grids', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS), {
    type: FLAT_TOP_HEX_GRID_TYPE,
    distance: 2.5,
    units: 'm',
  });
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS_SQUARE), {
    type: SQUARE_GRID_TYPE,
    distance: 2.5,
    units: 'm',
  });
});

test('battle Scenes support 10 metre hex and square grids', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.BATTLE), {
    type: FLAT_TOP_HEX_GRID_TYPE,
    distance: 10,
    units: 'm',
  });
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.BATTLE_SQUARE), {
    type: SQUARE_GRID_TYPE,
    distance: 10,
    units: 'm',
  });
});

test('city Scenes support 200 metre hex and square grids', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.CITY), {
    type: FLAT_TOP_HEX_GRID_TYPE,
    distance: 200,
    units: 'm',
  });
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.CITY_SQUARE), {
    type: SQUARE_GRID_TYPE,
    distance: 200,
    units: 'm',
  });
});

test('travel Scenes support 10 kilometre hex and square grids', () => {
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.TRAVEL), {
    type: FLAT_TOP_HEX_GRID_TYPE,
    distance: 10,
    units: 'km',
  });
  assert.deepEqual(getSceneGridPreset(SCENE_GRID_PRESET_IDS.TRAVEL_SQUARE), {
    type: SQUARE_GRID_TYPE,
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
    grid: { type: FLAT_TOP_HEX_GRID_TYPE, distance: 10, units: 'm' },
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

test('square presets retain the matching automation rules mode', () => {
  let update = null;
  const scene = { updateSource: value => { update = value; } };
  assert.equal(applySceneGridPresetSource(scene, SCENE_GRID_PRESET_IDS.CITY_SQUARE), true);
  assert.deepEqual(update.grid, { type: SQUARE_GRID_TYPE, distance: 200, units: 'm' });
  assert.equal(
    update.flags['fvtt-yze-generic-stepped'].sceneMode,
    SCENE_GRID_PRESET_IDS.CITY,
  );
  assert.equal(getSceneMode({
    flags: {
      'fvtt-yze-generic-stepped': { sceneMode: SCENE_GRID_PRESET_IDS.CITY_SQUARE },
    },
  }), SCENE_GRID_PRESET_IDS.CITY);
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
