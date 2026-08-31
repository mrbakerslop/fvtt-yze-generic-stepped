import { readFile, readdir } from 'node:fs/promises';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LOCALIZATION_BASELINES = Object.freeze({
  de: 489,
  es: 489,
  fr: 489,
  ru: 489,
  sv: 489,
  uk: 191,
});

/** Extract the flat localization keys used by the system's YAML catalogs. */
export function extractLocalizationKeys(source) {
  const keys = [];
  for (const line of String(source).split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+):/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

export function compareLocalizationKeys(englishKeys, translatedKeys) {
  const english = new Set(englishKeys);
  const translated = new Set(translatedKeys);
  return {
    duplicateKeys: translatedKeys.filter((key, index) => translatedKeys.indexOf(key) !== index),
    extraKeys: [...translated].filter(key => !english.has(key)).sort(),
    missingKeys: [...english].filter(key => !translated.has(key)).sort(),
    translatedKeys: translated.size,
  };
}

export async function auditLocalizations(directory = 'src/lang') {
  const files = (await readdir(directory)).filter(file => file.endsWith('.yml')).sort();
  const catalogs = Object.fromEntries(await Promise.all(files.map(async file => [
    basename(file, '.yml'),
    extractLocalizationKeys(await readFile(`${directory}/${file}`, 'utf8')),
  ])));
  const english = catalogs.en;
  if (!english) throw new Error('The English source localization catalog is missing.');
  return Object.fromEntries(Object.entries(catalogs).map(([language, keys]) => [
    language,
    compareLocalizationKeys(english, keys),
  ]));
}

async function main() {
  const strict = process.argv.includes('--strict');
  const audit = await auditLocalizations();
  const failures = [];

  for (const [language, result] of Object.entries(audit)) {
    if (result.duplicateKeys.length) failures.push(`${language}: duplicate keys: ${result.duplicateKeys.join(', ')}`);
    if (result.extraKeys.length) failures.push(`${language}: keys absent from English: ${result.extraKeys.join(', ')}`);
    const baseline = LOCALIZATION_BASELINES[language];
    if (baseline && result.translatedKeys < baseline) {
      failures.push(`${language}: ${result.translatedKeys} keys is below the ${baseline}-key baseline.`);
    }
    if (strict && result.missingKeys.length) {
      failures.push(`${language}: ${result.missingKeys.length} English keys are untranslated.`);
    }
    if (language !== 'en') {
      process.stdout.write(
        `${language}: ${result.translatedKeys} translated, ${result.missingKeys.length} falling back to English.\n`,
      );
    }
  }

  if (failures.length) throw new Error(failures.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
