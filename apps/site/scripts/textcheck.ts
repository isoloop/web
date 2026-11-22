// The raw-Markdown check: no page of the assembled site shows a reader
// Markdown that should have been rendered (a `backtick` span, **bold**), in
// its text or in the attributes that are read out or shown. No dependencies.
//   node scripts/textcheck.ts <dir>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '../../site');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return p.endsWith('.html') ? [p] : [];
  });
}

// What isn't prose: scripts, styles and code, where backticks and stars are the content.
const NOT_PROSE = /<(script|style|pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi;
const SHOWN_ATTR = /\s(?:aria-label|alt|title|content)\s*=\s*"([^"]*)"/gi;
// Code becomes a placeholder first, so two separate spans can't read as one.
const RAW = [/`[^`\n]{1,80}`/g, /\*\*[^*\s][^*\n]{0,80}\*\*/g];

/** The raw Markdown a page shows. */
function rawMarkdown(html: string): string[] {
  const prose = html.replace(NOT_PROSE, ' · ');
  const shown = [...prose.matchAll(SHOWN_ATTR)].map((m) => m[1] ?? '');
  const text = [prose.replace(/<[^>]+>/g, ''), ...shown].join('\n');
  return RAW.flatMap((re) => text.match(re) ?? []);
}

const pages = htmlFiles(root);
const problems = pages.flatMap((page) =>
  [...new Set(rawMarkdown(readFileSync(page, 'utf8')))].map((m) => `${relative(root, page)}: ${m}`),
);
if (problems.length) {
  console.error(
    `${problems.length} pieces of raw Markdown on the site:\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(`${pages.length} pages: no raw Markdown`);
