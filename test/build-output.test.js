import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanBuildOutput, copyMissingPacks } from '../tools/build-output.js';

test('rebuilds retain existing database files and seed only missing packs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yzegs-build-'));
  try {
    const source = join(root, 'source');
    const output = join(root, 'dist');
    await mkdir(join(source, 'existing'), { recursive: true });
    await mkdir(join(source, 'new-pack'), { recursive: true });
    await mkdir(join(output, 'packs', 'existing'), { recursive: true });
    const live = join(output, 'packs', 'existing', 'CURRENT');
    await writeFile(live, 'live database');
    const before = await stat(live);
    await writeFile(join(source, 'existing', 'CURRENT'), 'source database');
    await writeFile(join(source, 'new-pack', 'CURRENT'), 'new database');
    await writeFile(join(output, 'obsolete.js'), 'stale');
    await cleanBuildOutput(output);
    await copyMissingPacks(source, join(output, 'packs'));
    assert.equal(await readFile(live, 'utf8'), 'live database');
    assert.equal((await stat(live)).ino, before.ino);
    assert.equal(await readFile(join(output, 'packs', 'new-pack', 'CURRENT'), 'utf8'), 'new database');
    await assert.rejects(stat(join(output, 'obsolete.js')), { code: 'ENOENT' });
  }
  finally { await rm(root, { recursive: true, force: true }); }
});
