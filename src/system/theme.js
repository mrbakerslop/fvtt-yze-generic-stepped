/** Serializable theme data and CSS generation. No Foundry dependencies. */
export const THEME_SETTING = 'worldTheme';
export const READABLE_THEME_SETTING = 'useDefaultTheme';
export const CUSTOM_THEME_PRESETS_SETTING = 'customThemePresets';

export const THEME_FONTS = {
  nunito: 'Nunito Sans, sans-serif',
  mukta: 'Mukta, sans-serif',
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, monospace',
};

export const THEME_PRESETS = {
  monochrome: {
    background: '#ffffff', surface: '#ffffff', text: '#000000', heading: '#000000',
    border: '#000000', accent: '#000000', onAccent: '#ffffff',
    headingFont: 'nunito', bodyFont: 'mukta', headingCase: 'uppercase',
  },
  military: {
    background: '#edece2', surface: '#f7f6ee', text: '#24291f', heading: '#35432b',
    border: '#72785c', accent: '#465336', onAccent: '#ffffff',
    headingFont: 'sans', bodyFont: 'mukta', headingCase: 'uppercase',
  },
  parchment: {
    background: '#f1e4cb', surface: '#fbf3e3', text: '#352a20', heading: '#613e2b',
    border: '#927656', accent: '#74472e', onAccent: '#ffffff',
    headingFont: 'serif', bodyFont: 'serif', headingCase: 'none',
  },
  scifi: {
    background: '#151e29', surface: '#202e3c', text: '#e3edf6', heading: '#8adcec',
    border: '#647e93', accent: '#8adcec', onAccent: '#10202a',
    headingFont: 'mono', bodyFont: 'sans', headingCase: 'uppercase',
  },
};

export const THEME_COLORS = ['background', 'surface', 'text', 'heading', 'border', 'accent', 'onAccent'];
export const DEFAULT_THEME = { version: 1, preset: 'monochrome', overrides: {} };
const owns = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
const isCustomId = id => typeof id === 'string' && /^custom-[a-z0-9-]{1,64}$/i.test(id);

/** Accept only known keys and finite choices; never interpolate arbitrary CSS or URLs. */
export function normalizeTheme(value) {
  const source = value && typeof value === 'object' ? value : {};
  const preset = owns(THEME_PRESETS, source.preset) ? source.preset : 'monochrome';
  const overrides = {};
  const input = source.overrides && typeof source.overrides === 'object' ? source.overrides : {};
  for (const key of THEME_COLORS) {
    if (typeof input[key] === 'string' && /^#[0-9a-f]{6}$/i.test(input[key])) {
      overrides[key] = input[key].toLowerCase();
    }
  }
  for (const key of ['headingFont', 'bodyFont']) {
    if (owns(THEME_FONTS, input[key])) overrides[key] = input[key];
  }
  if (['none', 'uppercase'].includes(input.headingCase)) overrides.headingCase = input.headingCase;
  const result = { version: 1, preset, overrides };
  if (isCustomId(source.customPresetId)) result.customPresetId = source.customPresetId;
  return result;
}

/** Named presets are independent snapshots; the active world theme stays self-contained. */
export function normalizeCustomPresets(value) {
  const presets = [];
  for (const entry of Array.isArray(value) ? value : []) {
    if (!entry || !isCustomId(entry.id) || typeof entry.name !== 'string') continue;
    const label = entry.name.trim();
    if (!label || label.length > 80 || presets.some(p => p.id === entry.id)) continue;
    const theme = normalizeTheme(entry.theme);
    delete theme.customPresetId;
    presets.push({ id: entry.id, name: label, theme });
  }
  return presets;
}

export function addCustomPreset(value, entry, reservedNames = []) {
  const presets = normalizeCustomPresets(value);
  const label = String(entry.name ?? '').trim();
  if (!label || label.length > 80) throw new Error('YZEGS.Theme.PresetNameRequired');
  const names = [...reservedNames, ...presets.map(p => p.name)].map(n => n.trim().toLowerCase());
  if (names.includes(label.toLowerCase())) throw new Error('YZEGS.Theme.PresetNameExists');
  if (!isCustomId(entry.id) || presets.some(p => p.id === entry.id)) {
    throw new Error('YZEGS.Theme.PresetNameExists');
  }
  return [...presets, ...normalizeCustomPresets([{ ...entry, name: label }])];
}

export function renameCustomPreset(value, id, label, reservedNames = []) {
  const presets = normalizeCustomPresets(value);
  const selected = presets.find(p => p.id === id);
  if (!isCustomId(id) || !selected) throw new Error('YZEGS.Theme.CustomPresetOnly');
  const renamed = addCustomPreset(presets.filter(p => p.id !== id), {
    ...selected, name: label,
  }, reservedNames).at(-1);
  return presets.map(p => p.id === id ? renamed : p);
}

export function deleteCustomPreset(value, id) {
  const presets = normalizeCustomPresets(value);
  if (!isCustomId(id) || !presets.some(p => p.id === id)) throw new Error('YZEGS.Theme.CustomPresetOnly');
  return presets.filter(p => p.id !== id);
}

export function resolveTheme(value) {
  const theme = normalizeTheme(value);
  return { ...THEME_PRESETS[theme.preset], ...theme.overrides };
}

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

export function contrastRatio(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function hasLowContrast(value) {
  const theme = resolveTheme(value);
  return [['text', 'background'], ['text', 'surface'], ['heading', 'background'],
    ['heading', 'surface'], ['onAccent', 'accent']]
    .some(([first, second]) => contrastRatio(theme[first], theme[second]) < 4.5);
}

export function themeVariables(value) {
  const theme = resolveTheme(value);
  const dark = luminance(theme.background) < 0.179;
  return {
    ...Object.fromEntries(THEME_COLORS.map(key => [
      `--yzegs-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, theme[key],
    ])),
    '--yzegs-font-heading': THEME_FONTS[theme.headingFont],
    '--yzegs-font-body': THEME_FONTS[theme.bodyFont],
    '--yzegs-heading-case': theme.headingCase,
    '--yzegs-color-scheme': dark ? 'dark' : 'light',
    '--yzegs-danger': dark ? '#ff9690' : '#9b2423',
    '--yzegs-success': dark ? '#9ce0a4' : '#214d25',
  };
}

// Configuration windows deliberately never match this selector. Popovers inherit
// from their owning sheet, including when displayed in the browser's top layer.
export const THEME_SELECTOR = '.application.yzegs:is(.sheet, .dialog):not(.yzegs-settings), '
  + '.chat-message:has(.yzegs.chat-card)';

export function themeCSS(value) {
  const declarations = Object.entries(themeVariables(value)).map(([key, val]) => `${key}:${val}`).join(';');
  return `${THEME_SELECTOR}{${declarations}}`;
}
