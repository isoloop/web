// The docs manifest and pages (M4c, decisions 9–11).
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDocs, matchGuides, readManifest, type DocsManifest } from './pages.ts';

const PIN = 'e91662219b1d790bcbfdfed0a4d24082152fb6b2';

function fixture(
  manifest: unknown,
  guides: Record<string, string>,
): { manifest: string; guidesDir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'docs-'));
  const guidesDir = join(dir, 'guide');
  mkdirSync(guidesDir);
  for (const [slug, src] of Object.entries(guides))
    writeFileSync(join(guidesDir, `${slug}.md`), src);
  const file = join(dir, 'docs.json');
  writeFileSync(file, typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  return { manifest: file, guidesDir };
}

const load = (manifest: unknown, guides: Record<string, string>) =>
  loadDocs({
    ...fixture(manifest, guides),
    pin: PIN,
    kind: (p) => (p === 'docs/adr/0001-x.md' ? 'file' : undefined),
  });

const one = (slug: string, extra: object = {}): DocsManifest => ({
  sections: [{ title: 'Build', guides: [{ slug, ...extra }] }],
});

describe('readManifest', () => {
  it('names the file and the field of a bad entry', () => {
    const { manifest } = fixture(
      { sections: [{ title: 'Build', guides: [{ slug: 'Bad Slug' }] }] },
      {},
    );
    expect(() => readManifest(manifest)).toThrow(
      /docs\.json: sections\.0\.guides\.0\.slug: a guide slug/,
    );
  });

  it('refuses unknown fields, empty sections and a guide listed twice', () => {
    expect(() => readManifest(fixture({ sections: [], extra: 1 }, {}).manifest)).toThrow();
    expect(() =>
      readManifest(fixture({ sections: [{ title: 'Build', guides: [] }] }, {}).manifest),
    ).toThrow(/sections\.0\.guides/);
    const twice = {
      sections: [
        { title: 'Build', guides: [{ slug: 'pools' }] },
        { title: 'Agents', guides: [{ slug: 'pools' }] },
      ],
    };
    expect(() => readManifest(fixture(twice, {}).manifest)).toThrow(/"pools" is listed twice/);
  });

  it('names a file that is not JSON', () => {
    expect(() => readManifest(fixture('{ nope', {}).manifest)).toThrow(/not valid JSON/);
  });
});

describe('matchGuides', () => {
  it('fails on a guide at the pin that docs.json does not list', () => {
    expect(() => matchGuides(one('pools'), ['pools', 'bus'], 'docs.json')).toThrow(
      /docs\/guide\/bus\.md is at the pin but not in docs\.json/,
    );
  });

  it('fails on a listed guide the pin does not have', () => {
    expect(() => matchGuides(one('bus'), [], 'docs.json')).toThrow(
      /docs\.json lists "bus", but the pin has no docs\/guide\/bus\.md/,
    );
  });

  it('passes when both match', () => {
    expect(() => matchGuides(one('pools'), ['pools'], 'docs.json')).not.toThrow();
  });
});

describe('loadDocs', () => {
  const guide = `# Pools\n\nPools share one worker between isolates.\n\n## When\n\nSee [ADR 0001](../adr/0001-x.md) and [the bus](bus.md#retention).\n`;
  const bus = `# The bus\n\nThe bus keeps records.\n`;

  it('renders each guide in manifest order, with its page path, section and rewritten links', () => {
    const docs = load(
      { sections: [{ title: 'Build', guides: [{ slug: 'pools' }, { slug: 'bus' }] }] },
      { pools: guide, bus },
    );
    expect(docs.map((d) => [d.slug, d.path, d.section])).toEqual([
      ['pools', '/docs/pools/', 'Build'],
      ['bus', '/docs/bus/', 'Build'],
    ]);
    const pools = docs[0]!;
    expect(pools.title).toBe('Pools');
    expect(pools.description).toBe('Pools share one worker between isolates.');
    expect(pools.source).toBe('docs/guide/pools.md');
    expect(pools.html).toContain(
      `href="https://github.com/isoloop/isoloop/blob/${PIN}/docs/adr/0001-x.md"`,
    );
    expect(pools.html).toContain('href="/docs/bus/#retention"');
  });

  it('reads guides with CRLF line ends', () => {
    const docs = load(one('bus'), { bus: bus.replace(/\n/g, '\r\n') });
    expect(docs[0]!.description).toBe('The bus keeps records.');
  });

  it('fails on a dead relative link in a guide', () => {
    expect(() => load(one('bus'), { bus: `${bus}\nSee [x](../adr/0009-gone.md).\n` })).toThrow(
      /docs\/guide\/bus\.md: "\.\.\/adr\/0009-gone\.md"/,
    );
  });

  it('fails on a lead of several sentences, unless the guide is marked leadPending', () => {
    const long = `# Hosting\n\nWhat the page needs to send. The servers too.\n`;
    expect(() => load(one('hosting'), { hosting: long })).toThrow(/one sentence/);
    const [doc] = load(one('hosting', { leadPending: true }), { hosting: long });
    expect(doc!.description).toBe('What the page needs to send.');
  });

  it('fails once a leadPending guide has a one-sentence lead, so the mark comes off', () => {
    expect(() => load(one('bus', { leadPending: true }), { bus })).toThrow(
      /"bus" is marked leadPending, but its lead is one sentence now; remove the mark/,
    );
  });
});
