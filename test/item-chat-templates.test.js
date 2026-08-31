import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ITEM_CHAT_TEMPLATES } from '../src/system/item-chat-templates.js';

test('every Item data model resolves to an existing chat-card template', async () => {
  const manifest = JSON.parse(await readFile('static/system.json', 'utf8'));
  const itemTypes = Object.keys(manifest.documentTypes.Item).sort();

  assert.deepEqual(Object.keys(ITEM_CHAT_TEMPLATES).sort(), itemTypes);
  await Promise.all(Object.values(ITEM_CHAT_TEMPLATES).map(templatePath => {
    const sourcePath = templatePath
      .replace(
        'systems/fvtt-yze-generic-stepped/templates/components/chat/',
        '../src/components/chat/templates/',
      );
    return access(fileURLToPath(new URL(sourcePath, import.meta.url)));
  }));
});
