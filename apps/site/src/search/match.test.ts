// The docs' search, as a conformance suite: what any engine behind the
// DocsSearch interface must do. `engines` lists them; today it's our own
// (match.ts). A library put behind the same interface joins the list and has
// to pass every case.
import { describe, expect, it } from 'vitest';
import { createSearch, type DocsSearch, type SearchEntry, isEntries } from './match.ts';

const ENTRIES: SearchEntry[] = [
  {
    t: 'Worker pools',
    h: '',
    u: '/docs/pools/',
    s: 'Build',
    x: 'A pool puts several isolates in one worker.',
  },
  {
    t: 'Worker pools',
    h: 'Spawning into a pool',
    u: '/docs/pools/#spawning',
    s: 'Build',
    x: 'Call kernel.spawn with a pool name. Members share one event loop.',
  },
  {
    t: 'Automatic placement: the balancer',
    h: 'The quarantine',
    u: '/docs/balancer/#quarantine',
    s: 'Build',
    x: 'An offender waits in quarantine until it is quiet. Report busyMs with balancer.report.',
    e: 1,
  },
  {
    t: 'Contracts and grants',
    h: 'Grants',
    u: '/docs/contracts/#grants',
    s: 'Build',
    x: 'Each isolate gets a grant per topic it may publish or subscribe to, from @isoloop/bus.',
  },
  {
    t: 'Spawning isolates',
    h: '',
    u: '/docs/isolates/',
    s: 'Build',
    x: 'How to write an isolate.',
  },
];

const engines: [string, (e: SearchEntry[]) => DocsSearch][] = [['own (match.ts)', createSearch]];

describe.each(engines)('docs search: %s', (_name, make) => {
  const s = make(ENTRIES);
  const urls = (q: string): string[] => s.search(q).map((h) => h.entry.u);

  it('finds a word, case aside', () => {
    expect(urls('QUARANTINE')).toContain('/docs/balancer/#quarantine');
  });

  it('finds code identifiers whole and by their parts', () => {
    expect(urls('kernel.spawn')).toEqual(['/docs/pools/#spawning']);
    expect(urls('busyMs')).toEqual(['/docs/balancer/#quarantine']);
    expect(urls('busyms')).toEqual(['/docs/balancer/#quarantine']);
    expect(urls('@isoloop/bus')).toEqual(['/docs/contracts/#grants']);
    expect(urls('bus')).toContain('/docs/contracts/#grants');
  });

  it('meets a plural and its singular', () => {
    expect(urls('grant')).toContain('/docs/contracts/#grants');
    expect(urls('grants')).toContain('/docs/contracts/#grants');
  });

  it('matches the last word as a prefix while typing, the others whole', () => {
    expect(urls('quaran')).toContain('/docs/balancer/#quarantine');
    expect(urls('offender quaran')).toEqual(['/docs/balancer/#quarantine']);
    expect(urls('quaran offender')).toEqual([]);
    expect(urls('pool memb')).toEqual(['/docs/pools/#spawning']);
  });

  it('requires every word', () => {
    expect(urls('pool grant')).toEqual([]);
  });

  it('ranks a title over a heading over the text', () => {
    const spawn = urls('spawning');
    expect(spawn[0]).toBe('/docs/isolates/');
    expect(spawn[1]).toBe('/docs/pools/#spawning');
  });

  it('returns nothing for a nonsense word or an empty query, and respects the limit', () => {
    expect(urls('zzqxv')).toEqual([]);
    expect(urls('   ')).toEqual([]);
    expect(s.search('pool', 1)).toHaveLength(1);
  });

  it('gives a snippet around the match, with the matched words marked', () => {
    const [hit] = s.search('busyMs');
    expect(hit?.snippet).toContain('busyMs');
    const [a, b] = hit?.marks.snippet[0] ?? [0, 0];
    expect(hit?.snippet.slice(a, b).toLowerCase()).toBe('busyms');
  });

  it('carries the entry: title, heading, URL and the experimental mark', () => {
    const [hit] = s.search('quarantine');
    expect(hit?.entry).toMatchObject({
      t: 'Automatic placement: the balancer',
      h: 'The quarantine',
      e: 1,
    });
  });
});

describe('isEntries', () => {
  it('accepts an index and rejects anything else', () => {
    expect(isEntries([{ t: 'A', h: '', u: '/docs/a/', s: 'Build', x: 'text' }])).toBe(true);
    expect(isEntries([])).toBe(true);
    expect(isEntries({})).toBe(false);
    expect(isEntries([{ t: 'A' }])).toBe(false);
    expect(isEntries(null)).toBe(false);
  });
});
