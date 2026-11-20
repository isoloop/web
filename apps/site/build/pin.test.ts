// The pin-is-published decision (build/pin.ts), with the registry injected.
import { describe, expect, it } from 'vitest';
import type { LibraryReader } from './library.ts';
import {
  checkPublished,
  type Fetch,
  npmRegistry,
  pinnedPackages,
  provenanceCommit,
  type Registry,
} from './pin.ts';

const PIN = 'e91662219b1d790bcbfdfed0a4d24082152fb6b2';
const OTHER = '3c354e8e6fc220ddd78db82ef15b414a4098ecbd';

const reader = (files: Record<string, string>): LibraryReader => ({
  read: (p) => files[p],
  has: (p) => p in files,
  list: (dir) => Object.keys(files).filter((p) => p.startsWith(`${dir}/`)),
});

const registry = (published: Record<string, string | null>, calls: string[] = []): Registry => ({
  exists: async (name, version) => {
    calls.push(`exists ${name}@${version}`);
    return `${name}@${version}` in published;
  },
  gitCommit: async (name, version) => published[`${name}@${version}`] ?? undefined,
});

const pkgs = [
  { name: '@isoloop/bus', version: '0.1.0-next.7' },
  { name: '@isoloop/host', version: '0.1.0-next.7' },
];

describe('pinnedPackages', () => {
  it('lists the published packages at the pin and leaves private ones and nested files out', () => {
    const lib = reader({
      'packages/host/package.json': '{"name":"@isoloop/host","version":"0.1.0-next.7"}',
      'packages/bus/package.json': '{"name":"@isoloop/bus","version":"0.1.0-next.7"}',
      'packages/internal/package.json': '{"name":"x","version":"0.0.0","private":true}',
      'packages/host/src/fixtures/package.json': '{"name":"fixture","version":"1.0.0"}',
      'packages/host/README.md': '# host',
    });
    expect(pinnedPackages(lib)).toEqual(pkgs);
  });
});

describe('checkPublished', () => {
  it('passes when every package is on npm, attested to the pin', async () => {
    const r = registry({ '@isoloop/bus@0.1.0-next.7': PIN, '@isoloop/host@0.1.0-next.7': PIN });
    expect(await checkPublished(PIN, pkgs, r)).toEqual([]);
  });

  it('passes when some packages have no provenance, as long as one names the pin', async () => {
    const r = registry({ '@isoloop/bus@0.1.0-next.7': null, '@isoloop/host@0.1.0-next.7': PIN });
    expect(await checkPublished(PIN, pkgs, r)).toEqual([]);
  });

  it('fails a version that is not on npm yet', async () => {
    const r = registry({ '@isoloop/host@0.1.0-next.7': PIN });
    expect(await checkPublished(PIN, pkgs, r)).toEqual(["@isoloop/bus@0.1.0-next.7 isn't on npm"]);
  });

  it('fails a pin on another commit of main whose versions are published', async () => {
    const r = registry({ '@isoloop/bus@0.1.0-next.7': PIN, '@isoloop/host@0.1.0-next.7': PIN });
    expect(await checkPublished(OTHER, pkgs, r)).toEqual([
      '@isoloop/bus@0.1.0-next.7 was published from e916622, not the pin',
      '@isoloop/host@0.1.0-next.7 was published from e916622, not the pin',
    ]);
  });

  it('fails when no package has provenance to tie it to the pin', async () => {
    const r = registry({ '@isoloop/bus@0.1.0-next.7': null, '@isoloop/host@0.1.0-next.7': null });
    expect(await checkPublished(PIN, pkgs, r)).toEqual([
      'no package at e916622 has npm provenance naming its commit',
    ]);
  });

  it('fails a pin with no published packages', async () => {
    expect(await checkPublished(PIN, [], registry({}))).toHaveLength(1);
  });
});

const unavailable: Fetch = async () => new Response('', { status: 503 });

describe('npmRegistry', () => {
  const statement = {
    predicate: {
      buildDefinition: {
        resolvedDependencies: [
          {
            uri: 'git+https://github.com/isoloop/isoloop@refs/heads/main',
            digest: { gitCommit: PIN },
          },
        ],
      },
    },
  };
  const attestations = {
    attestations: [
      {
        predicateType: 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
        bundle: {},
      },
      {
        predicateType: 'https://slsa.dev/provenance/v1',
        bundle: {
          dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString('base64') },
        },
      },
    ],
  };

  it('reads the commit from the SLSA provenance', () => {
    expect(provenanceCommit(attestations)).toBe(PIN);
    expect(provenanceCommit({ attestations: [] })).toBeUndefined();
    expect(provenanceCommit(null)).toBeUndefined();
  });

  it('asks the registry by scoped name and version, and treats 404 as absent', async () => {
    const urls: string[] = [];
    const fake: Fetch = async (url) => {
      urls.push(url);
      if (url.includes('missing')) return new Response('', { status: 404 });
      if (url.includes('/attestations/')) return Response.json(attestations);
      return Response.json({ version: '0.1.0-next.7' });
    };
    const r = npmRegistry(fake, 'https://npm.test');
    expect(await r.exists('@isoloop/host', '0.1.0-next.7')).toBe(true);
    expect(await r.exists('@isoloop/missing', '1.0.0')).toBe(false);
    expect(await r.gitCommit('@isoloop/host', '0.1.0-next.7')).toBe(PIN);
    expect(await r.gitCommit('@isoloop/missing', '1.0.0')).toBeUndefined();
    expect(urls[0]).toBe('https://npm.test/@isoloop%2fhost/0.1.0-next.7');
    expect(urls[2]).toBe('https://npm.test/-/npm/v1/attestations/@isoloop%2fhost@0.1.0-next.7');
  });

  it('throws on a registry error instead of reading it as absent', async () => {
    await expect(npmRegistry(unavailable).exists('@isoloop/host', '1.0.0')).rejects.toThrow(
      'HTTP 503',
    );
  });
});
