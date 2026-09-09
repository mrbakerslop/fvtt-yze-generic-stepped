import {
  FRAME_PIECES, THEME_SHEETS, normalizeBackground, backgroundCSS, normalizeFrame, frameCSS,
  DEFAULT_THEME, THEME_SETTING,
  READABLE_THEME_SETTING, THEME_COLORS, THEME_FONTS,
  THEME_PRESETS, normalizeTheme, resolveTheme, themeCSS, themeVariables, hasLowContrast,
  CUSTOM_THEME_PRESETS_SETTING, normalizeCustomPresets, addCustomPreset, renameCustomPreset, deleteCustomPreset,
} from './theme.js';

const SYSTEM_ID = 'fvtt-yze-generic-stepped';
const STYLE_ID = 'yzegs-world-theme';

/** Settings onChange runs on each client when Foundry broadcasts a world update. */
export function applyWorldTheme() {
  if (typeof document === 'undefined') return;
  const theme = game.settings.get(SYSTEM_ID, READABLE_THEME_SETTING)
    ? DEFAULT_THEME : game.settings.get(SYSTEM_ID, THEME_SETTING);
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = themeCSS(theme);
}

export function registerThemeSettings() {
  game.settings.register(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING, {
    scope: 'world', config: false, type: Array, default: [],
  });
  game.settings.register(SYSTEM_ID, THEME_SETTING, {
    scope: 'world', config: false, type: Object,
    default: structuredClone(DEFAULT_THEME), onChange: applyWorldTheme,
  });
  game.settings.registerMenu(SYSTEM_ID, THEME_SETTING, {
    name: 'YZEGS.Theme.Title', label: 'YZEGS.Theme.Configure', hint: 'YZEGS.Theme.Hint',
    icon: 'fa-solid fa-palette', type: ThemeConfig, restricted: true,
  });
  game.settings.register(SYSTEM_ID, READABLE_THEME_SETTING, {
    scope: 'client', config: true, type: Boolean, default: false,
    name: 'YZEGS.Theme.Readable', hint: 'YZEGS.Theme.ReadableHint', onChange: applyWorldTheme,
  });
}

export class ThemeConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  #customPresets = [];
  #savingPreset = false;

  static DEFAULT_OPTIONS = {
    id: 'yzegs-theme-config', classes: ['yzegs-settings', 'theme-config'], tag: 'form',
    position: { width: 720, height: 1040 },
    window: { icon: 'fa-solid fa-palette', title: 'YZEGS.Theme.Title', contentClasses: ['standard-form'] },
    form: { closeOnSubmit: true, handler: ThemeConfig.#onSubmit },
    actions: {
      clearFramePiece: function (_event, button) {
        const { kind, piece } = button.dataset;
        if (!THEME_SHEETS.includes(kind) || !['image', ...FRAME_PIECES].includes(piece)) return;
        this.element.querySelector(`[name="frames.${kind}.${piece}"]`).value = '';
        this.#preview();
      },
      resetPreset: ThemeConfig.#resetPreset,
      resetDefault: ThemeConfig.#resetDefault,
      saveNewPreset: ThemeConfig.#saveNewPreset,
      renamePreset: ThemeConfig.#renamePreset,
      deletePreset: ThemeConfig.#deletePreset,
      cancel: function () { return this.close(); },
    },
  };

  static PARTS = {
    body: { template: 'systems/fvtt-yze-generic-stepped/templates/system/theme-config.hbs' },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const saved = normalizeTheme(game.settings.get(SYSTEM_ID, THEME_SETTING));
    this.#customPresets = normalizeCustomPresets(game.settings.get(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING));
    const selected = this.#customPresets.some(p => p.id === saved.customPresetId)
      ? saved.customPresetId : saved.preset;
    const values = resolveTheme(saved);
    return {
      ...context, preset: selected, values,
      backgrounds: THEME_SHEETS.map(kind => ({
        kind, label: `YZEGS.Theme.Sheets.${kind}`, ...normalizeBackground(saved.backgrounds?.[kind]),
      })),
      frames: THEME_SHEETS.map(kind => ({
        kind, label: `YZEGS.Theme.Sheets.${kind}`, ...normalizeFrame(saved.frames?.[kind]),
        pieces: FRAME_PIECES.map(key => ({ key, kind, label: `YZEGS.Theme.FramePiece.${key}`,
          image: normalizeFrame(saved.frames?.[kind])[key] ?? '' })),
      })),
      frameModes: { single: 'YZEGS.Theme.FrameSingle', pieces: 'YZEGS.Theme.FramePieces' },
      frameRepeats: { stretch: 'YZEGS.Theme.FrameStretch', repeat: 'YZEGS.Theme.FrameRepeat',
        round: 'YZEGS.Theme.FrameRound' },
      layouts: { cover: 'YZEGS.Theme.Cover', contain: 'YZEGS.Theme.Contain', tile: 'YZEGS.Theme.Tile' },
      positions: Object.fromEntries(['center', 'top', 'bottom', 'left', 'right'].map(key => [
        key, `YZEGS.Theme.Position.${key}`,
      ])),
      colors: THEME_COLORS.map(key => ({ key, label: `YZEGS.Theme.Colors.${key}`, value: values[key] })),
      presets: {
        ...Object.fromEntries(Object.keys(THEME_PRESETS).map(key => [
          key, game.i18n.localize(`YZEGS.Theme.Presets.${key}`),
        ])),
        ...Object.fromEntries(this.#customPresets.map(p => [p.id, p.name])),
      },
      fonts: Object.fromEntries(Object.keys(THEME_FONTS).map(key => [key, `YZEGS.Theme.Fonts.${key}`])),
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.addEventListener('input', () => this.#preview());
    this.element.addEventListener('change', event => {
      if (event.target.name === 'preset') this.#setFields(event.target.value);
      this.#preview();
    });
    this.#preview();
    this.#fillPresetName();
  }

  #fillPresetName() {
    const id = this.element.querySelector('[name="preset"]').value;
    this.element.querySelector('[name="newPresetName"]').value = this.#customPresets.find(p => p.id === id)?.name ?? '';
  }

  #readDraft() {
    const form = this.element;
    const preset = form.querySelector('[name="preset"]').value;
    const custom = this.#customPresets.find(p => p.id === preset);
    const basePreset = custom?.theme.preset ?? preset;
    const overrides = {};
    for (const key of [...THEME_COLORS, 'headingFont', 'bodyFont', 'headingCase']) {
      const value = form.querySelector(`[name="${key}"]`).value;
      if (value !== THEME_PRESETS[basePreset][key]) overrides[key] = value;
    }
    const backgrounds = Object.fromEntries(THEME_SHEETS.map(kind => [kind, Object.fromEntries(
      ['image', 'opacity', 'layout', 'position'].map(key => [
        key, form.querySelector(`[name="backgrounds.${kind}.${key}"]`)?.value,
      ]),
    )]));
    const sheetFrames = Object.fromEntries(THEME_SHEETS.map(kind => [kind, Object.fromEntries(
      ['image', 'width', 'slice', 'repeat', 'mode', ...FRAME_PIECES].map(key => [
        key, form.querySelector(`[name="frames.${kind}.${key}"]`)?.value,
      ]),
    )]));
    return normalizeTheme({
      preset: basePreset, overrides, customPresetId: custom?.id, backgrounds, frames: sheetFrames,
    });
  }

  #setFields(preset) {
    this.element.querySelector('[name="preset"]').value = preset;
    const custom = this.#customPresets.find(p => p.id === preset);
    const values = custom ? resolveTheme(custom.theme) : THEME_PRESETS[preset];
    for (const [key, value] of Object.entries(values)) {
      this.element.querySelector(`[name="${key}"]`).value = value;
    }
    for (const kind of THEME_SHEETS) {
      for (const [key, value] of Object.entries(normalizeBackground(custom?.theme.backgrounds?.[kind]))) {
        this.element.querySelector(`[name="backgrounds.${kind}.${key}"]`).value = value;
      }
    }
    for (const kind of THEME_SHEETS) {
      const frame = { mode: 'single', ...Object.fromEntries(FRAME_PIECES.map(piece => [piece, ''])),
        ...normalizeFrame(custom?.theme.frames?.[kind]) };
      for (const [key, value] of Object.entries(frame)) {
        this.element.querySelector(`[name="frames.${kind}.${key}"]`).value = value;
      }
    }
    this.#fillPresetName();
  }

  #preview() {
    const draft = this.#readDraft();
    for (const sheet of THEME_SHEETS) {
      const pieces = this.element.querySelector(`[name="frames.${sheet}.mode"]`).value === 'pieces';
      for (const group of this.element.querySelectorAll(`[data-frame-kind="${sheet}"]`)) {
        group.hidden = (group.dataset.frameMode === 'pieces') !== pieces;
      }
    }
    const preview = this.element.querySelector('.theme-preview');
    for (const [key, value] of Object.entries(themeVariables(draft))) preview.style.setProperty(key, value);
    const kind = this.element.querySelector('[name="previewSheet"]').value;
    const content = preview.querySelector('.theme-preview-content');
    content.style.cssText = [backgroundCSS(draft, kind), frameCSS(draft, kind)].filter(Boolean).join(';');
    for (const sample of content.querySelectorAll('[data-preview-sheet]')) {
      sample.hidden = sample.dataset.previewSheet !== kind;
    }
    this.element.querySelector('.theme-contrast-warning').hidden = !hasLowContrast(draft);
    for (const action of ['renamePreset', 'deletePreset']) {
      this.element.querySelector(`[data-action="${action}"]`).disabled = !draft.customPresetId || this.#savingPreset;
    }
  }

  static #resetPreset() {
    this.#setFields(this.element.querySelector('[name="preset"]').value);
    this.#preview();
  }

  static #resetDefault() {
    this.#setFields('monochrome');
    this.#preview();
  }

  static async #saveNewPreset(_event, button) {
    if (!game.user.isGM || this.#savingPreset) return;
    const input = this.element.querySelector('[name="newPresetName"]');
    const theme = this.#readDraft();
    const id = `custom-${foundry.utils.randomID()}`;
    let presets;
    try {
      presets = addCustomPreset(game.settings.get(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING), {
        id, name: input.value, theme,
      }, Object.keys(THEME_PRESETS).map(key => game.i18n.localize(`YZEGS.Theme.Presets.${key}`)));
    }
    catch (error) {
      ui.notifications.warn(game.i18n.localize(error.message));
      input.focus();
      return;
    }
    this.#savingPreset = true;
    button.disabled = true;
    try {
      await game.settings.set(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING, presets);
      this.#customPresets = presets;
      const select = this.element.querySelector('[name="preset"]');
      // Text is assigned through Option, never interpreted as HTML or localization keys.
      select.add(new Option(presets.at(-1).name, id));
      select.value = id;
      input.value = '';
      this.#preview();
      ui.notifications.info(game.i18n.localize('YZEGS.Theme.PresetCreated'));
    }
    finally {
      this.#savingPreset = false;
      button.disabled = false;
      this.#preview();
    }
  }

  static async #onSubmit() {
    if (!game.user.isGM) return;
    const draft = this.#readDraft();
    if (draft.customPresetId) {
      const presets = normalizeCustomPresets(game.settings.get(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING));
      const selected = presets.find(p => p.id === draft.customPresetId);
      if (selected) {
        // Store an independent snapshot, preserving the latest preset name and other entries.
        selected.theme = normalizeTheme(draft);
        delete selected.theme.customPresetId;
        await game.settings.set(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING, presets);
        this.#customPresets = presets;
      }
      else delete draft.customPresetId; // Another GM may have deleted it while this editor was open.
    }
    await game.settings.set(SYSTEM_ID, THEME_SETTING, draft);
    ui.notifications.info(game.i18n.localize('YZEGS.Theme.Saved'));
  }

  static async #renamePreset() {
    await this.#managePreset(false);
  }

  static async #deletePreset() {
    await this.#managePreset(true);
  }

  async #managePreset(remove) {
    if (!game.user.isGM || this.#savingPreset) return;
    const select = this.element.querySelector('[name="preset"]');
    const selected = this.#customPresets.find(p => p.id === select.value);
    if (!selected) return;
    this.#savingPreset = true;
    this.#preview();
    try {
      if (remove && !await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('YZEGS.Theme.DeletePreset') },
        classes: ['yzegs-settings'],
        content: `<p>${game.i18n.format('YZEGS.Theme.DeletePresetConfirm', {
          name: foundry.utils.escapeHTML(selected.name),
        })}</p>`,
        rejectClose: false,
      })) return;
      const latest = game.settings.get(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING);
      const presets = remove ? deleteCustomPreset(latest, selected.id) : renameCustomPreset(
        latest, selected.id, this.element.querySelector('[name="newPresetName"]').value,
        Object.keys(THEME_PRESETS).map(key => game.i18n.localize(`YZEGS.Theme.Presets.${key}`)),
      );
      await game.settings.set(SYSTEM_ID, CUSTOM_THEME_PRESETS_SETTING, presets);
      this.#customPresets = presets;
      const option = [...select.options].find(entry => entry.value === selected.id);
      if (remove) {
        option?.remove();
        // Keep the edited colours and fonts; only detach the draft from the removed preset.
        select.value = selected.theme.preset;
      }
      else if (option) option.textContent = presets.find(p => p.id === selected.id).name;
      this.#fillPresetName();
      ui.notifications.info(game.i18n.localize(remove ? 'YZEGS.Theme.PresetDeleted' : 'YZEGS.Theme.PresetRenamed'));
    }
    catch (error) {
      ui.notifications.warn(game.i18n.localize(error.message));
    }
    finally {
      this.#savingPreset = false;
      this.#preview();
    }
  }
}
