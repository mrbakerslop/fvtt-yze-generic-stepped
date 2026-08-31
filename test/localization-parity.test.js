import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditLocalizations,
  LOCALIZATION_BASELINES,
} from '../tools/localization-parity.js';

test('localization catalogs contain no duplicates, unknown keys, or coverage regressions', async () => {
  const audit = await auditLocalizations();
  assert.deepEqual(audit.en.duplicateKeys, []);

  for (const [language, baseline] of Object.entries(LOCALIZATION_BASELINES)) {
    assert.ok(audit[language], `${language} localization should exist`);
    assert.deepEqual(audit[language].duplicateKeys, [], `${language} has duplicate keys`);
    assert.deepEqual(audit[language].extraKeys, [], `${language} has keys which are absent from English`);
    assert.ok(
      audit[language].translatedKeys >= baseline,
      `${language} should not regress below ${baseline} translated keys`,
    );
  }
});
