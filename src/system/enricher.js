/* ------------------------------------------ */
/*  YZEGS SYMBOL                                */
/*   Generates a YZEGS symbol                   */
/* ------------------------------------------ */

/**
 * - $1: Symbol
 * @example "[[S]] or [[F]] or [[B]] etc."
 */
const YZEGS_SYMBOL_PATTERN = /\[\[([SFBRTDNC]+)\]\]/gm;

const YZEGS_SYMBOLS = {
  S: { icon: 'fa-crosshairs', label: 'Target' },
  F: { icon: 'fa-burst', label: 'Explosion' },
  B: { icon: 'fa-rocket', label: 'Projectile' },
  R: { icon: 'fa-road', label: 'Road' },
  T: { icon: 'fa-tree', label: 'Tree' },
  D: { icon: 'fa-sun', label: 'Day' },
  N: { icon: 'fa-moon', label: 'Night' },
  C: { icon: 'fa-fire', label: 'Campfire' },
};

async function yzegsSymbolEnricher(match) {
  const symbolDoc = document.createElement('span');
  symbolDoc.className = 'yzegs-symbol';
  symbolDoc.setAttribute('aria-label', [...match[1]].map(code => YZEGS_SYMBOLS[code].label).join(', '));

  for (const code of match[1]) {
    const iconDoc = document.createElement('i');
    iconDoc.className = `fa-solid ${YZEGS_SYMBOLS[code].icon}`;
    iconDoc.setAttribute('aria-hidden', 'true');
    symbolDoc.append(iconDoc);
  }

  return symbolDoc;
}

/* ------------------------------------------ */
/*  FONT AWESOME ICON                         */
/*   Generates a FontAwesome icon HTML text   */
/* ------------------------------------------ */

/**
 * - $1: Icon classes
 * @example "@FontAwesomeIcon[fas fa-cog]"
 */
const FONT_AWESOME_ICON_PATTERN = /@FontAwesomeIcon\[(.+?)\]/gm;

async function fontAwesomeIconEnricher(match) {
  const iconDoc = document.createElement('i');
  // iconDoc.style.textIndent = 0; // Fix for inherited <p> indent
  iconDoc.className = match[1];
  return iconDoc;
}

/* ------------------------------------------ */
/*  INLINE ICON IMAGE                         */
/*   Generates a small inline icon            */
/*   from an image                            */
/* ------------------------------------------ */

/**
 * - $1: Path to the image
 * - $2: Tooltip text
 * @example "@IconImage[icons/svg/dice-target.svg]{Dice Target}"
 */
const INLINE_ICON_IMAGE = /@IconImage\[(.+?)\](?:{(.+?)})?/gm;

async function iconImageEnricher(match) {
  const imgDoc = document.createElement('img');
  imgDoc.setAttribute('src', match[1]);
  // imgDoc.setAttribute('width', 16);
  // imgDoc.setAttribute('height', 16);
  imgDoc.style.width = '1em';
  imgDoc.style.height = '1em';
  imgDoc.style.verticalAlign = 'middle';
  // imgDoc.style.lineHeight = 0;
  imgDoc.className = 'nopopout';

  if (match[2]) {
    imgDoc.setAttribute('data-tooltip', match[2]);
  }

  return imgDoc;
}

/* ------------------------------------------ */

// function _createBrokenLink(type, title) {
//   return `<a class="${type} broken" data-id="null">`
//     // + '<i class="fa-solid fa-triangle-exclamation"></i>'
//     + '<i class="fa-solid fa-pen-slash"></i>'
//     + `${title}</a>`;
// }

export function enrichTextEditors() {
  CONFIG.TextEditor.enrichers.push(
    {
      pattern: YZEGS_SYMBOL_PATTERN,
      enricher: yzegsSymbolEnricher,
    },
    {
      pattern: FONT_AWESOME_ICON_PATTERN,
      enricher: fontAwesomeIconEnricher,
    },
    {
      pattern: INLINE_ICON_IMAGE,
      enricher: iconImageEnricher,
    });
}
