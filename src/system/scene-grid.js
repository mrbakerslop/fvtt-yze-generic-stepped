export const SCENE_GRID_PRESET_SETTING = 'defaultSceneGridPreset';
export const SCENE_MODE_FLAG = 'sceneMode';
export const URBAN_OPERATIONS_FLAG = 'urbanOperations';
export const CONFINED_SPACE_FLAG = 'confinedSpace';
const SYSTEM_ID = 'fvtt-yze-generic-stepped';

export const SCENE_GRID_PRESET_IDS = Object.freeze({
  SYSTEM: 'system',
  CLOSE_QUARTERS: 'twilightCloseQuarters',
  BATTLE: 'twilightBattle',
  CITY: 'twilightCity',
  TRAVEL: 'twilightTravel',
});

// The supported printed maps use flat-topped hexes. Odd-column offset is
// the most useful default; the Scene's core Grid Type control remains editable
// for images which begin on the opposite offset.
export const TWILIGHT_HEX_GRID_TYPE = 4;

export const SCENE_GRID_PRESETS = Object.freeze({
  // Urban Operations uses gridless sectors at roughly 1:125 scale. A 2.5 m
  // hex is the proportional Foundry approximation of the 10 m, 1:500 battle
  // maps, while keeping ordinary token movement and measurement available.
  [SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS]: Object.freeze({
    id: SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS,
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 2.5,
    units: 'm',
  }),
  [SCENE_GRID_PRESET_IDS.BATTLE]: Object.freeze({
    id: SCENE_GRID_PRESET_IDS.BATTLE,
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 10,
    units: 'm',
  }),
  [SCENE_GRID_PRESET_IDS.CITY]: Object.freeze({
    id: SCENE_GRID_PRESET_IDS.CITY,
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 200,
    units: 'm',
  }),
  [SCENE_GRID_PRESET_IDS.TRAVEL]: Object.freeze({
    id: SCENE_GRID_PRESET_IDS.TRAVEL,
    type: TWILIGHT_HEX_GRID_TYPE,
    distance: 10,
    units: 'km',
  }),
});

/** Return a safe Scene grid update for a named preset, or null for System Default. */
export function getSceneGridPreset(presetId) {
  const preset = SCENE_GRID_PRESETS[presetId];
  if (!preset) return null;
  return { type: preset.type, distance: preset.distance, units: preset.units };
}

/** Apply a preset to a pending Scene without changing its pixel size or alignment. */
export function applySceneGridPresetSource(scene, presetId) {
  const grid = getSceneGridPreset(presetId);
  if (!scene?.updateSource || !grid) return false;
  scene.updateSource({
    grid,
    flags: {
      [SYSTEM_ID]: {
        [SCENE_MODE_FLAG]: presetId,
        [URBAN_OPERATIONS_FLAG]: presetId === SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS,
      },
    },
  });
  return true;
}

/** Return the explicit scale attached to a Scene, with legacy scale inference. */
function activeScene() {
  return typeof canvas === 'undefined' ? null : canvas.scene;
}

export function getSceneMode(scene = null) {
  scene ??= activeScene();
  if (!scene) return SCENE_GRID_PRESET_IDS.SYSTEM;
  const explicit = scene.getFlag?.(SYSTEM_ID, SCENE_MODE_FLAG)
    ?? scene.flags?.[SYSTEM_ID]?.[SCENE_MODE_FLAG];
  if (Object.values(SCENE_GRID_PRESET_IDS).includes(explicit)) return explicit;
  const distance = Number(scene.grid?.distance);
  const units = String(scene.grid?.units ?? '').toLocaleLowerCase();
  if (units === 'm' && distance === 2.5) return SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS;
  if (units === 'm' && distance === 10) return SCENE_GRID_PRESET_IDS.BATTLE;
  if (units === 'm' && distance === 200) return SCENE_GRID_PRESET_IDS.CITY;
  if (units === 'km' && distance === 10) return SCENE_GRID_PRESET_IDS.TRAVEL;
  return SCENE_GRID_PRESET_IDS.SYSTEM;
}

export function isCloseQuartersScene(scene = null) {
  return getSceneMode(scene) === SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS;
}

export function isCityTravelScene(scene = null) {
  return getSceneMode(scene) === SCENE_GRID_PRESET_IDS.CITY;
}

export function isUrbanOperationsScene(scene = null) {
  if (isCloseQuartersScene(scene)) return true;
  const value = (
    scene?.getFlag?.(SYSTEM_ID, URBAN_OPERATIONS_FLAG)
    ?? scene?.flags?.[SYSTEM_ID]?.[URBAN_OPERATIONS_FLAG]
  );
  return value === true || value === 'true';
}

export function isConfinedSpaceScene(scene = null) {
  scene ??= activeScene();
  const value = (
    scene?.getFlag?.(SYSTEM_ID, CONFINED_SPACE_FLAG)
    ?? scene?.flags?.[SYSTEM_ID]?.[CONFINED_SPACE_FLAG]
  );
  return value === true || value === 'true';
}

function getDefaultPresetId() {
  return game.settings.get('fvtt-yze-generic-stepped', SCENE_GRID_PRESET_SETTING);
}

/** Apply the configured world default to a newly created Scene. */
export function applyDefaultSceneGrid(scene, _data, options, userId) {
  if (userId !== game.user.id || !game.user.isGM) return false;
  // Preserve Scene data deliberately imported from a compendium or JSON source.
  if (options?.fromCompendium || options?.sourceId || options?.imported) return false;
  return applySceneGridPresetSource(scene, getDefaultPresetId());
}

function setFormValue(form, fieldName, value) {
  const field = form?.elements?.namedItem(fieldName);
  if (!field) return null;
  field.value = String(value);
  return field;
}

/** Fill the native Scene configuration fields while preserving size and offsets. */
export function applySceneGridPresetForm(form, presetId) {
  const grid = getSceneGridPreset(presetId);
  if (!form || !grid) return false;
  const type = setFormValue(form, 'grid.type', grid.type);
  setFormValue(form, 'grid.distance', grid.distance);
  setFormValue(form, 'grid.units', grid.units);
  let mode = form.elements.namedItem(`flags.${SYSTEM_ID}.${SCENE_MODE_FLAG}`);
  if (!mode) {
    mode = document.createElement('input');
    mode.type = 'hidden';
    mode.name = `flags.${SYSTEM_ID}.${SCENE_MODE_FLAG}`;
    form.append(mode);
  }
  mode.value = presetId;
  let urban = form.elements.namedItem(`flags.${SYSTEM_ID}.${URBAN_OPERATIONS_FLAG}`);
  if (!urban) {
    urban = document.createElement('input');
    urban.type = 'hidden';
    urban.name = `flags.${SYSTEM_ID}.${URBAN_OPERATIONS_FLAG}`;
    urban.dataset.dtype = 'Boolean';
    form.append(urban);
  }
  const urbanEnabled = presetId === SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS;
  urban.value = String(urbanEnabled);
  if (urban.type === 'checkbox') urban.checked = urbanEnabled;
  const urbanToggle = form.querySelector('.scene-urban-operations input[type="checkbox"]');
  if (urbanToggle) urbanToggle.checked = urbanEnabled;
  (type ?? form).dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

async function onPresetButton(app, form, button) {
  const presetId = button.dataset.preset;
  button.disabled = true;
  try {
    if (!applySceneGridPresetForm(form, presetId)) return;
    const isExistingScene = Boolean(app.document?.id && game.scenes.has(app.document.id));
    if (isExistingScene) {
      await app.submit();
      ui.notifications.info(game.i18n.localize('YZEGS.SceneGrid.Applied'));
    }
    else ui.notifications.info(game.i18n.localize('YZEGS.SceneGrid.Prepared'));
  }
  catch (error) {
    console.error('yzegs | Failed to apply Scene grid preset.', error);
    ui.notifications.error(game.i18n.localize('YZEGS.SceneGrid.ApplyFailed'));
  }
  finally {
    if (button.isConnected) button.disabled = false;
  }
}

function createPresetButton(presetId, label, icon) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scene-grid-preset';
  button.dataset.preset = presetId;
  const iconElement = document.createElement('i');
  iconElement.className = icon;
  button.append(iconElement, document.createTextNode(` ${label}`));
  return button;
}

/** Add stepped-dice scale preset controls to the core Scene sheet. */
export function addSceneGridPresetControls(app, element) {
  if (!game.user.isGM || !app.isEditable) return;
  const root = element?.querySelector ? element : element?.[0];
  const form = app.form ?? root?.querySelector?.('form') ?? root?.closest?.('form');
  if (!form || form.querySelector('.scene-grid-presets')) return;
  const gridType = form.elements.namedItem('grid.type');
  if (!gridType) return;

  const panel = document.createElement('div');
  panel.className = 'scene-grid-presets form-group';
  const description = document.createElement('div');
  description.className = 'scene-grid-preset-description';
  const label = document.createElement('strong');
  label.textContent = game.i18n.localize('YZEGS.SceneGrid.Presets');
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = game.i18n.localize('YZEGS.SceneGrid.PresetsHint');
  description.append(label, hint);

  const urbanLabel = document.createElement('label');
  urbanLabel.className = 'checkbox scene-urban-operations';
  const urbanInput = document.createElement('input');
  urbanInput.type = 'checkbox';
  urbanInput.checked = isUrbanOperationsScene(app.document);
  const urbanValue = document.createElement('input');
  urbanValue.type = 'hidden';
  urbanValue.name = `flags.${SYSTEM_ID}.${URBAN_OPERATIONS_FLAG}`;
  urbanValue.dataset.dtype = 'Boolean';
  urbanValue.value = String(urbanInput.checked);
  urbanInput.addEventListener('change', () => { urbanValue.value = String(urbanInput.checked); });
  urbanLabel.append(urbanValue);
  urbanLabel.append(urbanInput, document.createTextNode(
    ` ${game.i18n.localize('YZEGS.SceneGrid.UrbanOperations')}`,
  ));
  description.append(urbanLabel);

  const confinedLabel = document.createElement('label');
  confinedLabel.className = 'checkbox scene-confined-space';
  const confinedInput = document.createElement('input');
  confinedInput.type = 'checkbox';
  confinedInput.checked = isConfinedSpaceScene(app.document);
  const confinedValue = document.createElement('input');
  confinedValue.type = 'hidden';
  confinedValue.name = `flags.${SYSTEM_ID}.${CONFINED_SPACE_FLAG}`;
  confinedValue.dataset.dtype = 'Boolean';
  confinedValue.value = String(confinedInput.checked);
  confinedInput.addEventListener('change', () => { confinedValue.value = String(confinedInput.checked); });
  confinedLabel.append(confinedValue);
  confinedLabel.append(confinedInput, document.createTextNode(
    ` ${game.i18n.localize('YZEGS.SceneGrid.ConfinedSpace')}`,
  ));
  description.append(confinedLabel);

  const buttons = document.createElement('div');
  buttons.className = 'scene-grid-preset-buttons';
  const closeQuarters = createPresetButton(
    SCENE_GRID_PRESET_IDS.CLOSE_QUARTERS,
    game.i18n.localize('YZEGS.SceneGrid.CloseQuarters'),
    'fas fa-warehouse',
  );
  const battle = createPresetButton(
    SCENE_GRID_PRESET_IDS.BATTLE,
    game.i18n.localize('YZEGS.SceneGrid.Battle'),
    'fas fa-person-rifle',
  );
  const city = createPresetButton(
    SCENE_GRID_PRESET_IDS.CITY,
    game.i18n.localize('YZEGS.SceneGrid.City'),
    'fas fa-city',
  );
  const travel = createPresetButton(
    SCENE_GRID_PRESET_IDS.TRAVEL,
    game.i18n.localize('YZEGS.SceneGrid.Travel'),
    'fas fa-map-location-dot',
  );
  for (const button of [closeQuarters, battle, city, travel]) {
    button.addEventListener('click', () => onPresetButton(app, form, button));
    buttons.append(button);
  }
  panel.append(description, buttons);

  const gridContainer = gridType.closest('[data-tab="grid"]')
    ?? gridType.closest('fieldset')
    ?? gridType.closest('.tab')
    ?? form;
  gridContainer.prepend(panel);
}

export function registerSceneGridHooks() {
  Hooks.on('preCreateScene', applyDefaultSceneGrid);
  Hooks.on('renderSceneConfig', addSceneGridPresetControls);
}
