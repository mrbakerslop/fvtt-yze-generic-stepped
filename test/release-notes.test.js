import assert from 'node:assert/strict';
import test from 'node:test';

import { extractReleaseNotes } from '../tools/release-notes.js';

const changelog = `# Changelog

## 2.0.0 — 2026-01-02

### Added

- Headline feature.

## 1.0.0 — 2026-01-01

### Added

- Initial release.
`;

test('release notes contain only the requested changelog section and comparison link', () => {
  assert.equal(extractReleaseNotes(changelog, 'v2.0.0', 'example/project'), `### Added

- Headline feature.

**Full Changelog**: https://github.com/example/project/compare/v1.0.0...v2.0.0`);
});

test('release notes fail clearly when the changelog entry is missing', () => {
  assert.throws(() => extractReleaseNotes(changelog, '3.0.0'), /no entry for 3\.0\.0/);
});
