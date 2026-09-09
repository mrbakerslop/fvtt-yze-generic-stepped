import { mkdir, readdir, rm, cp, access } from 'node:fs/promises';
import { join } from 'node:path';

/** Foundry may hold these databases open through the development symlink. */
export async function cleanBuildOutput(directory) {
  await mkdir(directory, { recursive: true });
  for (const entry of await readdir(directory)) {
    if (entry !== 'packs') await rm(join(directory, entry), { recursive: true, force: true });
  }
}

/** Seed new packs, but never overwrite an existing live database. */
export async function copyMissingPacks(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source)) {
    const target = join(destination, entry);
    try { await access(target); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await cp(join(source, entry), target, { recursive: true });
    }
  }
}
