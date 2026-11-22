// After the build: each build's JavaScript, gzipped, for the metrics panel's
// cost figures. Written as dist/<build>/build-stats.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { OPT_IN_PREFIX } from '../../../../shared/opt-in.ts';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );

for (const build of ['isoloop', 'native', 'native-workers']) {
  const dir = join('dist', build);
  // Opt-in files (the devtools panel, WebMCP) load only when asked for.
  const js = files(dir).filter((f) => f.endsWith('.js') && !basename(f).startsWith(OPT_IN_PREFIX));
  const jsGzipBytes = js.reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
  writeFileSync(join(dir, 'build-stats.json'), `${JSON.stringify({ jsGzipBytes })}\n`);
  console.log(`${dir}: ${(jsGzipBytes / 1024).toFixed(1)} KB of JS, gzipped`);
}
