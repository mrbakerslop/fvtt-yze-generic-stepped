import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = fileURLToPath(new URL('../src/', import.meta.url));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return files.flat();
}

test('all path-based Handlebars partials are preloaded', async () => {
  const templates = (await filesBelow(SOURCE_ROOT))
    .filter(path => path.endsWith('.hbs'));
  const preloadSource = await readFile(join(SOURCE_ROOT, 'system/handlebars.js'), 'utf8');
  const partialPattern = /{{>\s+["'](systems\/fvtt-yze-generic-stepped\/templates\/[^"']+)["']/g;
  const referenced = new Set();

  for (const template of templates) {
    const source = await readFile(template, 'utf8');
    for (const match of source.matchAll(partialPattern)) referenced.add(match[1]);
  }

  for (const partial of referenced) {
    assert.match(preloadSource, new RegExp(`['"]${partial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`));
  }
});
