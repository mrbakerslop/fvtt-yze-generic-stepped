import assert from 'node:assert/strict';
import test from 'node:test';

import { validateReleaseMetadata } from '../tools/validate-release.js';

test('release metadata accepts one consistent version', () => {
  assert.equal(validateReleaseMetadata({
    releaseTag: 'v14.0.14',
    packageVersion: '14.0.14',
    manifestVersion: '14.0.14',
    changelog: '# Changelog\n\n## 14.0.14 — Current\n',
  }), '14.0.14');
});

test('release metadata reports every inconsistent source', () => {
  assert.throws(() => validateReleaseMetadata({
    releaseTag: 'v14.0.15',
    packageVersion: '14.0.14',
    manifestVersion: '14.0.13',
    changelog: '# Changelog\n\n## 14.0.12 — Previous\n',
  }), error => {
    assert.match(error.message, /package\.json version 14\.0\.14/);
    assert.match(error.message, /static\/system\.json version 14\.0\.13/);
    assert.match(error.message, /CHANGELOG\.md has no entry for 14\.0\.15/);
    return true;
  });
});
