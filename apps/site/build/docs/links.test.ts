// Where a guide's links go on the site (M4c, decision 10).
import { describe, expect, it } from 'vitest';
import { LIBRARY_GITHUB, rewriteLink, type LinkContext } from './links.ts';
import { DocError } from './render.ts';

const PIN = 'e91662219b1d790bcbfdfed0a4d24082152fb6b2';
const FILES = new Set([
  'docs/guide/pools.md',
  'docs/guide/balancer.md',
  'docs/guide/draft.md',
  'docs/adr/0001-one-worker-per-isolate.md',
  'bench/pools/README.md',
  'docs/guide/assets/diagram.png',
]);
const DIRS = new Set(['packages/bus/src', 'bench/pools']);

const ctx: LinkContext = {
  file: 'docs/guide/pools.md',
  pin: PIN,
  guides: new Set(['pools', 'balancer']),
  kind: (p) => (FILES.has(p) ? 'file' : DIRS.has(p) ? 'dir' : undefined),
};
const link = (href: string): string => rewriteLink(href, 'link', ctx);

describe('rewriteLink', () => {
  it('sends a link to another guide on the site to its page, keeping the anchor', () => {
    expect(link('balancer.md')).toBe('/docs/balancer/');
    expect(link('balancer.md#the-cap')).toBe('/docs/balancer/#the-cap');
    expect(link('./balancer.md')).toBe('/docs/balancer/');
  });

  it('sends an ADR, a bench or other library file to GitHub at the pin', () => {
    expect(link('../adr/0001-one-worker-per-isolate.md')).toBe(
      `${LIBRARY_GITHUB}/blob/${PIN}/docs/adr/0001-one-worker-per-isolate.md`,
    );
    expect(link('../../bench/pools/README.md#results')).toBe(
      `${LIBRARY_GITHUB}/blob/${PIN}/bench/pools/README.md#results`,
    );
  });

  it('uses tree/ for a folder', () => {
    expect(link('../../packages/bus/src/')).toBe(`${LIBRARY_GITHUB}/tree/${PIN}/packages/bus/src`);
    expect(link('../../bench/pools')).toBe(`${LIBRARY_GITHUB}/tree/${PIN}/bench/pools`);
  });

  it('sends a guide at the pin that has no page to GitHub, like any library file', () => {
    expect(link('draft.md')).toBe(`${LIBRARY_GITHUB}/blob/${PIN}/docs/guide/draft.md`);
  });

  it('keeps absolute URLs, mail links and #anchors as written', () => {
    for (const href of ['https://example.org/x', 'mailto:a@b.c', '#limits', '//cdn.example/x']) {
      expect(link(href)).toBe(href);
    }
  });

  it('fails on a relative link to nothing at the pin, naming the guide, the link and the pin', () => {
    expect(() => link('../adr/9999-nope.md')).toThrow(DocError);
    expect(() => link('../adr/9999-nope.md')).toThrow(
      /docs\/guide\/pools\.md: "\.\.\/adr\/9999-nope\.md" resolves to docs\/adr\/9999-nope\.md, which isn't in isoloop\/isoloop at e916622/,
    );
  });

  it('fails on a link that leaves the repository or is root-absolute', () => {
    expect(() => link('../../../elsewhere.md')).toThrow(/outside isoloop\/isoloop/);
    expect(() => link('/docs/adr/x.md')).toThrow(/root-absolute/);
  });

  it('fails on a library image, which the CSP would block from GitHub', () => {
    expect(() => rewriteLink('assets/diagram.png', 'image', ctx)).toThrow(/CSP blocks/);
    expect(rewriteLink('https://isoloop.dev/og.png', 'image', ctx)).toBe(
      'https://isoloop.dev/og.png',
    );
  });
});
