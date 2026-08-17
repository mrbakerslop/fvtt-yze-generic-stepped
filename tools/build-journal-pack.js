import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceDirectory = join(projectRoot, 'content/journals');
const packPath = join(projectRoot, 'static/packs/system-journals');
const foundryAppPath = process.env.FOUNDRY_APP_PATH;

if (!foundryAppPath) {
  throw new Error('Set FOUNDRY_APP_PATH to the Foundry application directory.');
}

const classicLevelPath = join(foundryAppPath, 'node_modules/classic-level/index.js');
const { ClassicLevel } = await import(pathToFileURL(classicLevelPath));
const sourceFiles = (await readdir(sourceDirectory))
  .filter(file => file.endsWith('.json'))
  .sort((left, right) => left.localeCompare(right));
const sources = await Promise.all(sourceFiles.map(async file => ({
  file,
  data: JSON.parse(await readFile(join(sourceDirectory, file), 'utf8')),
})));
const documentIds = new Set();
for (const { file, data: source } of sources) {
  const sourceIds = [source.entry?._id, ...(source.pages ?? []).map(page => page._id)];
  for (const id of sourceIds) {
    if (typeof id !== 'string' || id.length !== 16) {
      throw new Error(`${file} contains an invalid 16-character document id: ${id}`);
    }
    if (documentIds.has(id)) throw new Error(`${file} contains the duplicate document id ${id}.`);
    documentIds.add(id);
  }
}
const packageData = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
const stats = {
  coreVersion: '14.366',
  systemId: packageData.name,
  systemVersion: packageData.version,
  createdTime: null,
  modifiedTime: null,
  lastModifiedBy: null,
  compendiumSource: null,
  duplicateSource: null,
  exportSource: null,
};

if (!packPath.startsWith(join(projectRoot, 'static/packs/'))) {
  throw new Error(`Refusing to replace unexpected pack path: ${packPath}`);
}

await rm(packPath, { recursive: true, force: true });
await mkdir(dirname(packPath), { recursive: true });

const database = new ClassicLevel(packPath, { keyEncoding: 'utf8', valueEncoding: 'utf8' });
await database.open();

let pageCount = 0;
for (const { data: source } of sources) {
  const entry = {
    ...source.entry,
    pages: source.pages.map(page => page._id),
    _stats: stats,
  };
  await database.put(`!journal!${entry._id}`, JSON.stringify(entry));

  for (const page of source.pages) {
    const journalPage = {
      _id: page._id,
      name: page.name,
      type: 'text',
      sort: page.sort,
      text: { content: page.content, format: 1 },
      system: {},
      title: { show: true, level: 1 },
      image: {},
      video: { controls: true, volume: 0.5 },
      src: null,
      category: null,
      ownership: { default: -1 },
      flags: {},
      _stats: stats,
    };
    await database.put(`!journal.pages!${entry._id}.${page._id}`, JSON.stringify(journalPage));
    pageCount += 1;
  }
}

// Flush the write-ahead log into an immutable table so a clean checkout has
// every document even though transient *.log files are ignored by Git.
await database.compactRange('\x00', '\xff');
await database.close();
console.log(`Built ${sources.length} Journal entries with ${pageCount} pages in ${packPath}`);
