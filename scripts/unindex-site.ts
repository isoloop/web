// The preview's last pass over the assembled site (ADR 0007, decision 10):
// every page says noindex and has no canonical, including the pages that are
// copied in as they are rather than built through ui/vite (the plant's
// architecture page, the redirects). Run by assemble-site.sh when
// ISOLOOP_PREVIEW=1.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unindex } from '../packages/ui/src/preview.ts';

const root = process.argv[2];
if (!root) throw new Error('usage: node scripts/unindex-site.ts <site dir>');
let pages = 0;
for (const file of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
  if (!file.endsWith('.html')) continue;
  const path = join(root, file);
  const html = readFileSync(path, 'utf8');
  const out = unindex(html);
  if (out !== html) writeFileSync(path, out);
  pages++;
}
console.log(`unindex-site: ${pages} pages say noindex`);
