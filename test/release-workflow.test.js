import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('release workflow validates and builds before publishing a draft', async () => {
  const workflow = await readFile('.github/workflows/release.yml', 'utf8');
  const validate = workflow.indexOf('node tools/validate-release.js');
  const testAndBuild = workflow.indexOf('run: npm test');
  const createRelease = workflow.indexOf('gh release create');
  const upload = workflow.indexOf('gh release upload');
  const publish = workflow.indexOf('gh release edit "$RELEASE_TAG" --draft=false');

  assert.ok(validate >= 0);
  assert.ok(testAndBuild > validate);
  assert.ok(createRelease > testAndBuild);
  assert.match(workflow.slice(createRelease, upload), /--draft/);
  assert.ok(upload > createRelease);
  assert.ok(publish > upload);
});
