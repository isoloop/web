// `pnpm --filter site check-pin`: fails unless library.lock pins a published
// version of the library (build/pin.ts). Run in the site CI job; it needs the
// network, so the build itself doesn't run it.
import { fileURLToPath } from 'node:url';
import { ensureLibrary, libraryReader, readPin } from '../build/library.ts';
import { checkPublished, npmRegistry, pinnedPackages } from '../build/pin.ts';

const siteDir = fileURLToPath(new URL('..', import.meta.url));
ensureLibrary(siteDir);
const pin = readPin(siteDir);
const packages = pinnedPackages(libraryReader(siteDir));
const problems = await checkPublished(pin, packages, npmRegistry());
if (problems.length > 0) {
  console.error(`library.lock pins ${pin}, which isn't a published version (ADR 0006):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('Pin the commit a version was published from (its `chore: version` commit).');
  process.exit(1);
}
console.log(
  `isoloop/isoloop ${pin.slice(0, 7)}: ${packages.length} packages published from the pin`,
);
