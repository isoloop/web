// The docs for agents (M4c, decision 16): llms.txt, llms-full.txt and the
// pages' Markdown copies.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { site } from '../../src/copy.ts';
import { absoluteLink, buildLlms, llmsTxt, markdownCopy, SKILL } from './llms.ts';
import { LIBRARY_GITHUB, type LinkContext } from './links.ts';
import type { Doc } from './pages.ts';
import { DocError } from './render.ts';

const PIN = 'e91662219b1d790bcbfdfed0a4d24082152fb6b2';
const ORIGIN = 'https://isoloop.dev';
const FILES = new Set([
  'docs/guide/pools.md',
  'docs/guide/balancer.md',
  'docs/adr/0001-one-worker-per-isolate.md',
  'bench/pools/README.md',
]);
const ctx: LinkContext = {
  file: 'docs/guide/pools.md',
  pin: PIN,
  guides: new Set(['pools', 'balancer']),
  kind: (p) => (FILES.has(p) ? 'file' : undefined),
};
const ADR = `${LIBRARY_GITHUB}/blob/${PIN}/docs/adr/0001-one-worker-per-isolate.md`;

const doc = (slug: string, section: string, title: string, description: string): Doc => ({
  slug,
  kind: slug.startsWith('api/') ? 'api' : 'guide',
  section,
  experimental: false,
  path: `/docs/${slug}/`,
  title,
  description,
  html: '',
  leadHtml: '',
  body: '',
  headings: [],
  source: slug.startsWith('api/') ? `docs/api/${slug.slice(4)}.md` : `docs/guide/${slug}.md`,
});
const DOCS = [
  doc('pools', 'Build', 'Pools', 'Run many isolates on one worker.'),
  doc('balancer', 'Build', 'Balancer', 'Place isolates by their measured busy time.'),
  doc('agents', 'Agents and tooling', 'Agents', 'Expose tools to agents.'),
];

describe('absoluteLink', () => {
  it('sends another guide to its Markdown copy, keeping the anchor', () => {
    expect(absoluteLink('balancer.md', ctx)).toBe(`${ORIGIN}/docs/balancer.md`);
    expect(absoluteLink('balancer.md#the-cap', ctx)).toBe(`${ORIGIN}/docs/balancer.md#the-cap`);
  });

  it('sends a library file to GitHub at the pin, and keeps absolute URLs and anchors', () => {
    expect(absoluteLink('../adr/0001-one-worker-per-isolate.md', ctx)).toBe(ADR);
    expect(absoluteLink('https://example.org/x', ctx)).toBe('https://example.org/x');
    expect(absoluteLink('#limits', ctx)).toBe('#limits');
  });

  it('fails on a relative link to nothing at the pin, as the pages do', () => {
    expect(() => absoluteLink('../adr/9999-nope.md', ctx)).toThrow(DocError);
  });
});

describe('markdownCopy', () => {
  const guide = [
    '# Pools',
    '',
    'Run many isolates on one worker.',
    '',
    'See the [balancer](balancer.md) and,',
    'on a second line, [ADR 0001](../adr/0001-one-worker-per-isolate.md#context).',
    '',
    '| Table | Link |',
    '| --- | --- |',
    '| bench | [results](../../bench/pools/README.md) |',
    '',
    'A [reference link][adr] and [another][adr].',
    '',
    '[adr]: ../adr/0001-one-worker-per-isolate.md',
    '',
    '```md',
    'Not a link: [x](balancer.md)',
    '```',
    '',
    'In code: `[x](balancer.md)`, and a [top](#pools) anchor.',
    '',
  ].join('\n');
  const copy = markdownCopy(guide, ctx);

  it('makes inline links absolute, on any line of their block', () => {
    expect(copy).toContain(`[balancer](${ORIGIN}/docs/balancer.md)`);
    expect(copy).toContain(`[ADR 0001](${ADR}#context)`);
    expect(copy).toContain(`[results](${LIBRARY_GITHUB}/blob/${PIN}/bench/pools/README.md)`);
  });

  it('rewrites a reference definition once, and leaves its uses alone', () => {
    expect(copy).toContain(`[adr]: ${ADR}`);
    expect(copy).toContain('A [reference link][adr] and [another][adr].');
  });

  it('leaves code blocks, code spans and #anchors as written', () => {
    expect(copy).toContain('Not a link: [x](balancer.md)');
    expect(copy).toContain('`[x](balancer.md)`');
    expect(copy).toContain('[top](#pools)');
  });

  it('keeps everything else byte for byte', () => {
    expect(copy.split('\n')).toHaveLength(guide.split('\n').length);
    expect(copy.split('\n').slice(0, 4)).toEqual(guide.split('\n').slice(0, 4));
  });
});

describe('llmsTxt', () => {
  const txt = llmsTxt(DOCS, PIN);

  it('opens with the H1 and the site description, as llmstxt.org asks', () => {
    expect(txt.startsWith(`# Isoloop\n\n> ${site.description}\n\n`)).toBe(true);
  });

  it('lists every page under its section, in order, with its .md link and description', () => {
    expect(txt).toContain(
      [
        '## Build',
        '',
        `- [Pools](${ORIGIN}/docs/pools.md): Run many isolates on one worker.`,
        `- [Balancer](${ORIGIN}/docs/balancer.md): Place isolates by their measured busy time.`,
        '',
        '## Agents and tooling',
        '',
        `- [Agents](${ORIGIN}/docs/agents.md): Expose tools to agents.`,
      ].join('\n'),
    );
  });

  it('links the agent skill at the pin, before the Optional section', () => {
    const skill = txt.indexOf('## Agent skill');
    expect(skill).toBeGreaterThan(0);
    expect(skill).toBeLessThan(txt.indexOf('## Optional'));
    expect(txt.slice(skill)).toContain(`(${LIBRARY_GITHUB}/blob/${PIN}/${SKILL})`);
    expect(txt).toContain('npx isoloop skill add');
  });

  it('ends with an Optional section: the examples hub and the README at the pin', () => {
    const optional = txt.slice(txt.indexOf('## Optional'));
    expect(optional).toContain(`(${ORIGIN}/examples/)`);
    expect(optional).toContain(`(${LIBRARY_GITHUB}/blob/${PIN}/README.md)`);
  });

  it('has no relative link anywhere', () => {
    for (const [, href] of txt.matchAll(/\]\(([^)]+)\)/g)) expect(href).toMatch(/^https:\/\//);
  });
});

const apiKind = (p: string): 'file' | undefined =>
  ['docs/guide/pools.md', 'docs/api/host.md', 'docs/api/runtime.md'].includes(p)
    ? 'file'
    : undefined;

describe('an API page for agents', () => {
  const guides = mkdtempSync(join(tmpdir(), 'llms-g-'));
  const api = mkdtempSync(join(tmpdir(), 'llms-a-'));
  writeFileSync(join(guides, 'pools.md'), '# Pools\n\nRun many isolates on one worker.\n');
  writeFileSync(
    join(api, 'host.md'),
    '# @isoloop/host\n\nThe main thread.\n\n### `createKernel`\n\n**Guides:** [Pools](../guide/pools.md), [`defineIsolate`](runtime.md#defineisolate)\n\n<!-- Generated by scripts/docs/api.ts from the published types: do not edit. -->\n',
  );
  writeFileSync(join(api, 'runtime.md'), '# @isoloop/runtime\n\nThe isolate side.\n');
  const docs = [
    doc('pools', 'Build', 'Pools', 'Run many isolates on one worker.'),
    doc('api/host', 'Reference', '@isoloop/host', 'The main thread.'),
    doc('api/runtime', 'Reference', '@isoloop/runtime', 'The isolate side.'),
  ];
  const files = new Map(
    buildLlms({ docs, guidesDir: guides, apiDir: api, pin: PIN, kind: apiKind }).map((f) => [
      f.fileName,
      f.source,
    ]),
  );

  it('gets a Markdown copy at /docs/api/<name>.md, without the generator note, its links absolute', () => {
    const md = files.get('docs/api/host.md') ?? '';
    expect(md).not.toContain('Generated by');
    expect(md).toContain(`[Pools](${ORIGIN}/docs/pools.md)`);
    expect(md).toContain(`[\`defineIsolate\`](${ORIGIN}/docs/api/runtime.md#defineisolate)`);
  });

  it('is listed in llms.txt under its section', () => {
    expect(files.get('llms.txt')).toContain(
      `## Reference\n\n- [@isoloop/host](${ORIGIN}/docs/api/host.md): The main thread.`,
    );
  });
});

describe('buildLlms', () => {
  const dir = mkdtempSync(join(tmpdir(), 'llms-'));
  writeFileSync(
    join(dir, 'pools.md'),
    '# Pools\r\n\r\nRun many isolates on one worker.\r\n\r\nSee [balancer](balancer.md).\r\n',
  );
  writeFileSync(
    join(dir, 'balancer.md'),
    '# Balancer\n\nPlace isolates by their measured busy time.\n\nSee [pools](pools.md#when).\n',
  );
  const docs = DOCS.slice(0, 2);
  const files = new Map(
    buildLlms({ docs, guidesDir: dir, pin: PIN, kind: ctx.kind }).map((f) => [
      f.fileName,
      f.source,
    ]),
  );

  it('emits llms.txt, llms-full.txt and one .md per page', () => {
    expect([...files.keys()].toSorted()).toEqual([
      'docs/balancer.md',
      'docs/pools.md',
      'llms-full.txt',
      'llms.txt',
    ]);
    expect(files.get('docs/pools.md')).toBe(
      `# Pools\n\nRun many isolates on one worker.\n\nSee [balancer](${ORIGIN}/docs/balancer.md).\n`,
    );
  });

  it('puts every guide in llms-full.txt in nav order, each under its URL', () => {
    const full = files.get('llms-full.txt') ?? '';
    const pools = full.indexOf(`Source: ${ORIGIN}/docs/pools.md\n\n# Pools`);
    const balancer = full.indexOf(`Source: ${ORIGIN}/docs/balancer.md\n\n# Balancer`);
    expect(pools).toBeGreaterThan(0);
    expect(balancer).toBeGreaterThan(pools);
    expect(full).toContain(`See [pools](${ORIGIN}/docs/pools.md#when).`);
  });
});
