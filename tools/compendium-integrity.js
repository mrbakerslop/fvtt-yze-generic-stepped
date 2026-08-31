import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ClassicLevel } from 'classic-level';

const ROOT_PREFIX = '!actors!';
const EMBEDDED_PREFIX = '!actors.items!';
export const DEFAULT_ACTOR_PACK = 'static/packs/system-actors';

export function classifyActorPackKeys(keys) {
  const actors = new Set();
  const embedded = [];

  for (const key of keys) {
    if (key.startsWith(ROOT_PREFIX)) actors.add(key.slice(ROOT_PREFIX.length));
    else if (key.startsWith(EMBEDDED_PREFIX)) {
      const embeddedId = key.slice(EMBEDDED_PREFIX.length);
      embedded.push({ key, actorId: embeddedId.split('.', 1)[0] });
    }
  }

  const orphanedKeys = embedded
    .filter(entry => !actors.has(entry.actorId))
    .map(entry => entry.key);
  return {
    actors: actors.size,
    embedded: embedded.length,
    linked: embedded.length - orphanedKeys.length,
    orphanedKeys,
  };
}

async function readKeys(packPath) {
  const db = new ClassicLevel(packPath, { createIfMissing: false });
  try {
    await db.open();
    const keys = [];
    for await (const key of db.keys()) keys.push(String(key));
    return keys;
  }
  finally {
    await db.close();
  }
}

/** Inspect a disposable copy because opening LevelDB may rewrite recovery metadata. */
export async function inspectActorPack(packPath = DEFAULT_ACTOR_PACK) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'yzegs-compendium-'));
  const copyPath = join(temporaryRoot, basename(packPath));
  try {
    await cp(resolve(packPath), copyPath, { recursive: true });
    return classifyActorPackKeys(await readKeys(copyPath));
  }
  finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function removeOrphanedActorItems(packPath = DEFAULT_ACTOR_PACK) {
  const resolvedPath = resolve(packPath);
  const db = new ClassicLevel(resolvedPath, { createIfMissing: false });
  let audit;
  try {
    await db.open();
    const keys = [];
    for await (const key of db.keys()) keys.push(String(key));
    audit = classifyActorPackKeys(keys);
    if (audit.orphanedKeys.length) {
      await db.batch(audit.orphanedKeys.map(key => ({ type: 'del', key })), { sync: true });
      await db.compactRange('', '\uffff');
    }
  }
  finally {
    await db.close();
  }
  return { ...audit, removed: audit.orphanedKeys.length };
}

function formatAudit(audit) {
  return `${audit.actors} actors, ${audit.linked}/${audit.embedded} linked embedded items, `
    + `${audit.orphanedKeys.length} orphaned.`;
}

async function main() {
  const fix = process.argv.includes('--fix');
  const packArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
  const packPath = packArgument ?? DEFAULT_ACTOR_PACK;

  if (fix) {
    const result = await removeOrphanedActorItems(packPath);
    console.log(`Removed ${result.removed} orphaned actor-compendium records.`);
  }

  const audit = await inspectActorPack(packPath);
  console.log(`Actor compendium: ${formatAudit(audit)}`);
  if (audit.orphanedKeys.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
