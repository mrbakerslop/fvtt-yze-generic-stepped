/* global globalThis */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_THEME, THEME_PRESETS, normalizeTheme, resolveTheme, themeCSS,
  themeVariables, contrastRatio, hasLowContrast,
  addCustomPreset, normalizeCustomPresets, renameCustomPreset, deleteCustomPreset,
} from '../src/system/theme.js';

test('renaming and deleting custom presets preserve snapshots and protect all built-ins', () => {
  const presets = addCustomPreset([], {
    id: 'custom-rose', name: 'Rose', theme: { preset: 'monochrome', overrides: { background: '#fd8686' } },
  });
  const active = normalizeTheme({ ...presets[0].theme, customPresetId: 'custom-rose' });
  const originalCSS = themeCSS(active);
  const renamed = renameCustomPreset(presets, 'custom-rose', '  Coral  ');
  assert.equal(renamed[0].name, 'Coral');
  assert.equal(renamed[0].id, 'custom-rose');
  assert.deepEqual(renamed[0].theme, presets[0].theme);
  assert.equal(presets[0].name, 'Rose');
  assert.deepEqual(deleteCustomPreset(renamed, 'custom-rose'), []);
  assert.equal(themeCSS(active), originalCSS);
  for (const preset of Object.keys(THEME_PRESETS)) {
    assert.throws(() => renameCustomPreset(presets, preset, 'Changed'), /CustomPresetOnly/);
    assert.throws(() => deleteCustomPreset(presets, preset), /CustomPresetOnly/);
  }
  assert.throws(() => renameCustomPreset(presets, 'custom-rose', ''), /PresetNameRequired/);
  assert.throws(() => renameCustomPreset(presets, 'custom-rose', 'Military', ['Military']), /PresetNameExists/);
  const two = addCustomPreset(presets, { id: 'custom-other', name: 'Other', theme: DEFAULT_THEME });
  assert.throws(() => renameCustomPreset(two, 'custom-rose', ' other '), /PresetNameExists/);
  assert.deepEqual(renameCustomPreset(presets, 'custom-rose', 'Rose'), presets);
  assert.throws(() => deleteCustomPreset(presets, 'custom-missing'), /CustomPresetOnly/);
});

test('named presets preserve independent snapshots and do not change their source', () => {
  const original = { preset: 'military', overrides: { accent: '#112233' } };
  const first = addCustomPreset([], { id: 'custom-first', name: ' My campaign ', theme: original });
  const second = addCustomPreset(first, {
    id: 'custom-second', name: 'Night variant',
    theme: { ...first[0].theme, customPresetId: 'custom-first', overrides: { accent: '#445566' } },
  });
  assert.equal(first.length, 1);
  assert.equal(second.length, 2);
  assert.equal(second[0].name, 'My campaign');
  assert.equal(resolveTheme(second[0].theme).accent, '#112233');
  assert.equal(resolveTheme(second[1].theme).accent, '#445566');
  assert.equal(second[1].theme.customPresetId, undefined);
  assert.equal(THEME_PRESETS.military.accent, '#465336');
  original.overrides.accent = '#ffffff';
  assert.equal(resolveTheme(first[0].theme).accent, '#112233');
  const active = normalizeTheme({ ...second[1].theme, customPresetId: second[1].id });
  assert.equal(active.customPresetId, 'custom-second');
  assert.equal(resolveTheme(active).accent, '#445566', 'active theme needs no preset library to render');
});

test('custom presets reject blank and duplicate names and sanitize stored data', () => {
  const entry = { id: 'custom-test', name: 'Campaign', theme: DEFAULT_THEME };
  const presets = addCustomPreset([], entry);
  assert.throws(() => addCustomPreset(presets, { ...entry, id: 'custom-other', name: ' campaign ' }),
    /PresetNameExists/);
  assert.throws(() => addCustomPreset([], { ...entry, name: ' ' }), /PresetNameRequired/);
  assert.throws(() => addCustomPreset([], { ...entry, name: 'x'.repeat(81) }), /PresetNameRequired/);
  assert.throws(() => addCustomPreset([], { ...entry, name: 'military' }, ['Military']), /PresetNameExists/);
  assert.deepEqual(normalizeCustomPresets([null, { ...entry, id: '__proto__' }, entry, entry]), presets);
  assert.deepEqual(normalizeCustomPresets({}), []);
});

test('themes reject unknown properties, malformed values and CSS injection', () => {
  const theme = normalizeTheme({
    version: 999, preset: '__proto__',
    overrides: {
      background: '#ABCDEF', text: '#fff; } body { display: none',
      headingFont: 'url(https://example.invalid/font)', bodyFont: '__proto__',
      headingCase: 'sideways', image: 'https://example.invalid/image',
    },
  });
  assert.deepEqual(theme, { ...DEFAULT_THEME, overrides: { background: '#abcdef' } });
  assert.deepEqual(normalizeTheme(null), DEFAULT_THEME);
  assert.deepEqual(normalizeTheme({ overrides: [] }), DEFAULT_THEME);
  assert.doesNotMatch(themeCSS(theme), /url\(|display:|__proto__/);
});

test('preset overrides are isolated and original monochrome is the default', () => {
  const value = { preset: 'military', overrides: { text: '#123456', headingFont: 'mono' } };
  assert.equal(resolveTheme(value).text, '#123456');
  assert.equal(resolveTheme(value).background, THEME_PRESETS.military.background);
  assert.equal(THEME_PRESETS.military.text, '#24291f');
  assert.deepEqual(resolveTheme(undefined), THEME_PRESETS.monochrome);
  assert.equal(themeVariables(value)['--yzegs-font-heading'], 'ui-monospace, monospace');
  assert.equal(themeVariables({ preset: 'scifi' })['--yzegs-color-scheme'], 'dark');
});

test('presets are readable and contrast warnings catch unreadable custom colours', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  for (const preset of Object.keys(THEME_PRESETS)) assert.equal(hasLowContrast({ preset }), false, preset);
  assert.equal(hasLowContrast({ overrides: { text: '#ffffff' } }), true);
  assert.equal(hasLowContrast({ overrides: { onAccent: '#000000' } }), true);
});

test('all world configuration windows are excluded from gameplay theme selectors', async () => {
  const files = [
    'world-settings-config', 'experience-config', 'character-field-labels', 'token-size-defaults-config',
    'combat-modifiers', 'action-skills-config', 'social-conflict-config', 'theme-config',
  ];
  for (const fileName of files) {
    const source = await readFile(new URL(`../src/system/${fileName}.js`, import.meta.url), 'utf8');
    assert.match(source, /classes: \['yzegs-settings',/, fileName);
    assert.doesNotMatch(source, /classes: \['yzegs',/, fileName);
  }
  const css = themeCSS({ preset: 'scifi' });
  assert.match(css, /:not\(\.yzegs-settings\)/);
  assert.match(css, /\.chat-message:has\(\.yzegs.chat-card\)/);
  assert.doesNotMatch(css, /:root|body\s*\{|\.journal/);
});

test('theme settings propagate changes and client readability override can recover locally', async () => {
  const callbacks = new Map();
  const settings = new Map();
  const nodes = new Map();
  globalThis.foundry = { applications: { api: {
    HandlebarsApplicationMixin: Base => Base, ApplicationV2: class {
      async _prepareContext() { return {}; }
    },
  } } };
  globalThis.game = { settings: {
    register(_namespace, key, options) { settings.set(key, options.default); callbacks.set(key, options); },
    registerMenu(_namespace, _key, options) { assert.equal(options.restricted, true); },
    get: (_namespace, key) => settings.get(key),
  } };
  globalThis.document = {
    getElementById: id => nodes.get(id), createElement: () => ({}),
    head: { append: node => nodes.set(node.id, node) },
  };
  try {
    const { registerThemeSettings, applyWorldTheme } = await import('../src/system/theme-config.js');
    registerThemeSettings();
    assert.equal(callbacks.get('worldTheme').scope, 'world');
    assert.equal(callbacks.get('useDefaultTheme').scope, 'client');
    applyWorldTheme();
    assert.equal(nodes.size, 1);
    settings.set('worldTheme', { preset: 'scifi' });
    callbacks.get('worldTheme').onChange();
    assert.equal(nodes.get('yzegs-world-theme').textContent, themeCSS({ preset: 'scifi' }));
    settings.set('useDefaultTheme', true);
    callbacks.get('useDefaultTheme').onChange();
    assert.equal(nodes.get('yzegs-world-theme').textContent, themeCSS(DEFAULT_THEME));
    assert.deepEqual(settings.get('worldTheme'), { preset: 'scifi' });
    settings.set('useDefaultTheme', false);
    callbacks.get('useDefaultTheme').onChange();
    assert.equal(nodes.get('yzegs-world-theme').textContent, themeCSS({ preset: 'scifi' }));
    assert.equal(nodes.size, 1);
  }
  finally {
    delete globalThis.document;
    delete globalThis.game;
    delete globalThis.foundry;
  }
});

test('Save Theme updates the selected custom snapshot and preserves other presets and built-ins', async () => {
  const { ThemeConfig } = await import('../src/system/theme-config.js');
  const presets = ['v1', 'v2'].map(id => ({
    id: `custom-${id}`, name: `Test ${id}`,
    theme: normalizeTheme({ overrides: { background: '#ff88aa' } }),
  }));
  const settings = new Map([
    ['customThemePresets', presets],
    ['worldTheme', { ...presets[1].theme, customPresetId: 'custom-v2' }],
  ]);
  globalThis.game = {
    user: { isGM: true }, i18n: { localize: key => key },
    settings: {
      get: (_namespace, key) => structuredClone(settings.get(key)),
      set: async (_namespace, key, value) => settings.set(key, structuredClone(value)),
    },
  };
  globalThis.ui = { notifications: { info: message => assert.equal(message, 'YZEGS.Theme.Saved') } };
  try {
    const editor = new ThemeConfig();
    await editor._prepareContext({});
    const fields = { ...resolveTheme(presets[1].theme), preset: 'custom-v2', background: '#800080' };
    editor.element = { querySelector: selector => ({ value: fields[selector.match(/name="([^"]+)"/)[1]] }) };
    const submit = () => ThemeConfig.DEFAULT_OPTIONS.form.handler.call(editor);
    // Keep a rename made after the editor opened.
    settings.get('customThemePresets')[1].name = 'Renamed v2';
    await submit();
    const saved = settings.get('customThemePresets');
    assert.deepEqual(saved[0], presets[0]);
    assert.equal(saved[1].name, 'Renamed v2');
    assert.equal(resolveTheme(saved[1].theme).background, '#800080');
    assert.equal(saved[1].theme.customPresetId, undefined);
    assert.equal(settings.get('worldTheme').customPresetId, 'custom-v2');
    assert.equal(resolveTheme(settings.get('worldTheme')).background, '#800080');
    // Reopening and selecting the saved snapshot retains the edit.
    const reopened = await new ThemeConfig()._prepareContext({});
    assert.equal(reopened.preset, 'custom-v2');
    assert.equal(reopened.values.background, '#800080');
    for (const preset of Object.keys(THEME_PRESETS)) {
      fields.preset = preset;
      await submit();
      assert.deepEqual(settings.get('customThemePresets'), saved);
    }
    fields.preset = 'custom-v2';
    settings.set('customThemePresets', [presets[0]]);
    await submit();
    assert.deepEqual(settings.get('customThemePresets'), [presets[0]], 'deleted presets are not resurrected');
    assert.equal(settings.get('worldTheme').customPresetId, undefined);
  }
  finally {
    delete globalThis.game;
    delete globalThis.ui;
  }
});
