import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function normalizeVersion(value) {
  return String(value ?? '').replace(/^v/, '');
}

/** Validate that a release tag, package, manifest, and changelog describe one version. */
export function validateReleaseMetadata({ releaseTag, packageVersion, manifestVersion, changelog }) {
  const tagVersion = normalizeVersion(releaseTag);
  const errors = [];

  if (!tagVersion) errors.push('A release tag is required.');
  if (packageVersion !== tagVersion) {
    errors.push(`package.json version ${packageVersion} does not match tag v${tagVersion}.`);
  }
  if (manifestVersion !== tagVersion) {
    errors.push(`static/system.json version ${manifestVersion} does not match tag v${tagVersion}.`);
  }
  const changelogPattern = new RegExp(`^##\\s+${tagVersion.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:\\s|$)`, 'm');
  if (!changelogPattern.test(changelog)) {
    errors.push(`CHANGELOG.md has no entry for ${tagVersion}.`);
  }

  if (errors.length) throw new Error(errors.join('\n'));
  return tagVersion;
}

async function main() {
  const [packageSource, manifestSource, changelog] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('static/system.json', 'utf8'),
    readFile('CHANGELOG.md', 'utf8'),
  ]);
  const packageJson = JSON.parse(packageSource);
  const manifest = JSON.parse(manifestSource);
  const version = validateReleaseMetadata({
    releaseTag: process.argv[2] ?? process.env.GITHUB_REF_NAME,
    packageVersion: packageJson.version,
    manifestVersion: manifest.version,
    changelog,
  });
  process.stdout.write(`Release metadata is consistent for v${version}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
