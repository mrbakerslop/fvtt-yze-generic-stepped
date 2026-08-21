import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Extract one version's section from the project changelog. */
export function extractReleaseNotes(changelog, requestedVersion, repository = '') {
  const version = String(requestedVersion ?? '').replace(/^v/, '');
  const headings = [...String(changelog).matchAll(/^##\s+([^\s]+).*$/gm)];
  const index = headings.findIndex(match => match[1] === version);
  if (index < 0) throw new Error(`CHANGELOG.md has no entry for ${version}.`);

  const start = headings[index].index + headings[index][0].length;
  const end = headings[index + 1]?.index ?? changelog.length;
  let notes = String(changelog).slice(start, end).trim();
  const previousVersion = headings[index + 1]?.[1];
  if (repository && previousVersion) {
    notes += `\n\n**Full Changelog**: https://github.com/${repository}/compare/`
      + `v${previousVersion}...v${version}`;
  }
  return notes;
}

async function main() {
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  process.stdout.write(`${extractReleaseNotes(
    changelog,
    process.argv[2],
    process.env.GITHUB_REPOSITORY,
  )}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
