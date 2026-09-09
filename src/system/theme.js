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

export const THEME_SHEETS = ['character', 'item', 'journal'];
export const DEFAULT_BACKGROUND = { image: '', opacity: 25, layout: 'cover', position: 'center' };

function imagePath(value) {
  if (typeof value !== 'string') return '';
  const path = value.trim();
  // Only relative asset paths and HTTP(S); reject CSS delimiters and active URL schemes.
  // eslint-disable-next-line no-control-regex
  if (/[\\\x00-\x1f"'<>]/.test(path) || path.startsWith('//')) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^https?:\/\//i.test(path)) return '';
  return path;
}

export function normalizeBackground(value = {}) {
  return {
    image: imagePath(value?.image),
    opacity: Number.isFinite(Number(value?.opacity))
      ? Math.min(100, Math.max(0, Number(value.opacity))) : DEFAULT_BACKGROUND.opacity,
    layout: ['cover', 'contain', 'tile'].includes(value?.layout) ? value.layout : 'cover',
    position: ['center', 'top', 'bottom', 'left', 'right'].includes(value?.position) ? value.position : 'center',
  };
}

export const FRAME_PIECES = ['topLeft', 'top', 'topRight', 'right', 'bottomRight', 'bottom', 'bottomLeft', 'left'];

/** Slice is the percentage cut from each edge to preserve the four image corners. */
export function normalizeFrame(value = {}) {
  const bounded = (input, fallback, min, max) => input !== '' && Number.isFinite(Number(input))
    ? Math.min(max, Math.max(min, Number(input))) : fallback;
  const result = {
    image: imagePath(value?.image),
    width: bounded(value?.width, 16, 0, 48),
    slice: bounded(value?.slice, 15, 1, 49),
    repeat: ['stretch', 'repeat', 'round'].includes(value?.repeat) ? value.repeat : 'stretch',
  };
  if (value?.mode === 'pieces') result.mode = 'pieces';
  for (const key of FRAME_PIECES) {
    const path = imagePath(value?.[key]);
    if (path) result[key] = path;
  }
  return result;
}

/** Accept only known keys, finite choices and sanitized image paths. */
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
  const backgrounds = {};
  for (const kind of THEME_SHEETS) {
    const background = normalizeBackground(source.backgrounds?.[kind]);
    if (background.image) backgrounds[kind] = background;
  }
  if (Object.keys(backgrounds).length) result.backgrounds = backgrounds;
  const sheetFrames = {};
  for (const kind of THEME_SHEETS) {
    const frame = normalizeFrame(source.frames?.[kind]);
    if (frame.image || FRAME_PIECES.some(key => frame[key])) sheetFrames[kind] = frame;
  }
  if (Object.keys(sheetFrames).length) result.frames = sheetFrames;
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

function backgroundDeclarations(value, kind) {
  const theme = normalizeTheme(value);
  const background = normalizeBackground(theme.backgrounds?.[kind]);
  if (!background.image) return {};
  const color = resolveTheme(theme).background;
  const channels = color.slice(1).match(/../g).map(channel => parseInt(channel, 16)).join(',');
  const wash = `rgba(${channels},${1 - background.opacity / 100})`;
  return {
    'background-color': color,
    'background-image': `linear-gradient(${wash},${wash}),url("${background.image}")`,
    'background-size': `auto,${background.layout === 'tile' ? 'auto' : background.layout}`,
    'background-repeat': `no-repeat,${background.layout === 'tile' ? 'repeat' : 'no-repeat'}`,
    'background-position': `center,${background.position}`,
  };
}

export function backgroundCSS(value, kind) {
  return Object.entries(backgroundDeclarations(value, kind)).map(([key, val]) => `${key}:${val}`).join(';');
}

export function frameCSS(value, kind) {
  const theme = normalizeTheme(value);
  const frame = normalizeFrame(theme.frames?.[kind]);
  if (frame.mode === 'pieces') return pieceFrameCSS(theme, kind, frame);
  if (!frame.image || !frame.width) return '';
  return `border:${frame.width}px solid ${resolveTheme(theme).border};`
    + `border-image-source:url("${frame.image}");border-image-slice:${frame.slice}%;`
    + `border-image-width:1;border-image-outset:0;border-image-repeat:${frame.repeat};box-sizing:border-box`;
}

function pieceFrameCSS(theme, kind, frame) {
  if (!frame.width || !FRAME_PIECES.some(key => frame[key])) return '';
  const w = `${frame.width}px`;
  const span = `calc(100% - ${frame.width * 2}px)`;
  const positions = ['left top', 'center top', 'right top', 'right center',
    'right bottom', 'center bottom', 'left bottom', 'left center'];
  const sizes = [`${w} ${w}`, `${span} ${w}`, `${w} ${w}`, `${w} ${span}`,
    `${w} ${w}`, `${span} ${w}`, `${w} ${w}`, `${w} ${span}`];
  // Each piece has its own fixed area. The transparent border reserves space without covering inputs.
  const tiled = frame.repeat !== 'stretch';
  const images = FRAME_PIECES.map((key, index) => frame[key] && !(tiled && index % 2)
    ? `url("${frame[key]}")` : 'none');
  const repeats = FRAME_PIECES.map(() => 'no-repeat');
  const origins = FRAME_PIECES.map(() => 'border-box');
  const declarations = backgroundDeclarations(theme, kind);
  if (declarations['background-image']) {
    images.push(declarations['background-image']);
    sizes.push(declarations['background-size']);
    positions.push(declarations['background-position']);
    repeats.push(declarations['background-repeat']);
    origins.push('padding-box', 'padding-box');
  }
  const edges = tiled ? `position:relative;--yzegs-frame-edge-display:block;--yzegs-frame-width:${w};`
    + `--yzegs-frame-repeat:${frame.repeat};`
    + ['top', 'bottom', 'left', 'right'].map(key =>
      `--yzegs-frame-${key}:${frame[key] ? `url("${frame[key]}")` : 'none'}`).join(';') + ';' : '';
  return edges + `border:${w} solid transparent;border-image:none;box-sizing:border-box;`
    + `background-image:${images.join(',')};background-size:${sizes.join(',')};`
    + `background-position:${positions.join(',')};background-repeat:${repeats.join(',')};`
    + `background-origin:${origins.join(',')};background-clip:border-box`
    + (tiled ? `;border-width:0;padding:calc(${w} + 12px)` : '');
}

/** Two clipped edge areas repeat up to, but never underneath, the corner squares. */
export function frameEdgeCSS(selector) {
  return `${selector}::before,${selector}::after{content:"";display:var(--yzegs-frame-edge-display,none);`
    + 'position:absolute;pointer-events:none;box-sizing:border-box;}'
    + `${selector}::before{left:var(--yzegs-frame-width);right:var(--yzegs-frame-width);top:0;bottom:0;`
    + 'background-image:var(--yzegs-frame-top),var(--yzegs-frame-bottom);'
    + 'background-position:left top,left bottom;background-size:auto var(--yzegs-frame-width);'
    + 'background-repeat:var(--yzegs-frame-repeat) no-repeat;}'
    + `${selector}::after{top:var(--yzegs-frame-width);bottom:var(--yzegs-frame-width);left:0;right:0;`
    + 'background-image:var(--yzegs-frame-left),var(--yzegs-frame-right);'
    + 'background-position:left top,right top;background-size:var(--yzegs-frame-width) auto;'
    + 'background-repeat:no-repeat var(--yzegs-frame-repeat);}';
}

export const BACKGROUND_SELECTORS = {
  character: '.application.yzegs.actor.character:not(.yzegs-settings) > .window-content',
  item: '.application.yzegs.item:not(.yzegs-settings) > .window-content',
  journal: '.journal-entry .journal-entry-page.text section.journal-page-content',
};

export function themeCSS(value) {
  const declarations = Object.entries(themeVariables(value)).map(([key, val]) => `${key}:${val}`).join(';');
  return `${THEME_SELECTOR}{${declarations}}`
    + frameEdgeCSS('.application.theme-config .theme-preview-content') + THEME_SHEETS.map(kind => {
    const css = [backgroundCSS(value, kind), frameCSS(value, kind)].filter(Boolean).join(';');
    const text = resolveTheme(value).text;
    const font = THEME_FONTS[resolveTheme(value).bodyFont];
    const journal = kind === 'journal' ? `color:${text};font-family:${font};padding:12px;` : '';
    const frame = normalizeFrame(normalizeTheme(value).frames?.[kind]);
    const edgeRules = frame.mode === 'pieces' && frame.repeat !== 'stretch'
      ? frameEdgeCSS(BACKGROUND_SELECTORS[kind]) : '';
    return css ? `${BACKGROUND_SELECTORS[kind]}{${journal}${css}}${edgeRules}` : '';
  }).join('');
}
