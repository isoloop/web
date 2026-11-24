import { describe, expect, it } from 'vitest';
import {
  absoluteLinks,
  byPackageOrder,
  isDependencyOnly,
  isInternal,
  loadChangelog,
  newestFirst,
  parseChangelog,
} from './changelog.ts';

// The shape Changesets 3 writes: a version per `##`, kinds per `###`, one
// bullet per changeset, its later paragraphs indented by two spaces.
const MD = `# @isoloop/bus

## 0.1.0-next.1

### Patch Changes

- 1a2b3c4: \`dispose()\` gives back the claim.

  A second paragraph, with a [link](../../docs/adr/0017-x.md).

  - first point
  - second point
    continued

## 0.1.0-next.0

### Minor Changes

- 9f8e7d6: The log bus, run in its own worker.

## Earlier releases

Listed by tags.
`;

describe('parseChangelog', () => {
  it('reads versions, kinds, bullets and their continued paragraphs and lists', () => {
    const releases = parseChangelog(MD);
    expect(releases.map((r) => r.version)).toEqual(['0.1.0-next.1', '0.1.0-next.0']);
    const first = releases[0]?.groups[0];
    expect(first?.kind).toBe('Patch Changes');
    expect(first?.entries).toEqual([
      [
        { kind: 'p', text: '`dispose()` gives back the claim.' },
        { kind: 'p', text: 'A second paragraph, with a [link](../../docs/adr/0017-x.md).' },
        { kind: 'ul', items: ['first point', 'second point continued'] },
      ],
    ]);
    expect(releases[1]?.groups[0]?.entries).toEqual([
      [{ kind: 'p', text: 'The log bus, run in its own worker.' }],
    ]);
  });

  it('keeps a section without kinds as its intro', () => {
    const md = `# @isoloop/host

## 0.1.0

The first release.

- **Contained failures:** one isolate can't freeze the others.
- **Supervision:** restarts.

The previews are below.

## 0.1.0-next.12

### Patch Changes

- 2788228: Docs of \`lagMs\`.
`;
    const [first, second] = parseChangelog(md);
    expect(first).toEqual({
      version: '0.1.0',
      intro: [
        { kind: 'p', text: 'The first release.' },
        {
          kind: 'ul',
          items: [
            "**Contained failures:** one isolate can't freeze the others.",
            '**Supervision:** restarts.',
          ],
        },
        { kind: 'p', text: 'The previews are below.' },
      ],
      groups: [],
    });
    expect(second?.groups[0]?.entries).toEqual([[{ kind: 'p', text: 'Docs of `lagMs`.' }]]);
  });

  it('leaves out dependency-only entries, and a section left with nothing', () => {
    const md = `# @isoloop/host

## 0.1.0-next.12

### Patch Changes

- cceac10: A real change.
- Updated dependencies [2788228]
- Updated dependencies [3afc5f8]
  - @isoloop/protocol@0.1.0-next.12

## 0.1.0-next.11

### Patch Changes

- @isoloop/dom@0.1.0-next.11
  - @isoloop/protocol@0.1.0-next.11
`;
    const releases = parseChangelog(md);
    expect(releases.map((r) => r.version)).toEqual(['0.1.0-next.12']);
    expect(releases[0]?.groups[0]?.entries).toEqual([[{ kind: 'p', text: 'A real change.' }]]);
  });

  it('skips sections that are not versions', () => {
    expect(parseChangelog('# site\n\n## Earlier releases\n\nTags.\n')).toEqual([]);
  });
});

const p = (text: string): { kind: 'p'; text: string }[] => [{ kind: 'p', text }];

describe('isDependencyOnly', () => {
  it('tells a dependency bump from a change', () => {
    expect(isDependencyOnly(p('Updated dependencies [abc1234]'))).toBe(true);
    expect(isDependencyOnly(p('@isoloop/dom@0.1.0-next.11'))).toBe(true);
    expect(isDependencyOnly(p('`@isoloop/dom` renders SVG.'))).toBe(false);
  });
});

describe('absoluteLinks', () => {
  it('resolves relative links from the changelog folder and keeps absolute ones', () => {
    expect(
      absoluteLinks(
        'See [ADR](../../docs/adr/1.md), [web](https://isoloop.dev/) and [top](#a).',
        'https://github.com/isoloop/isoloop/blob/abc',
        'packages/bus',
      ),
    ).toBe(
      'See [ADR](https://github.com/isoloop/isoloop/blob/abc/docs/adr/1.md), [web](https://isoloop.dev/) and [top](#a).',
    );
  });
});

describe('newestFirst', () => {
  it('orders releases, prereleases and numbered prerelease parts', () => {
    expect(
      ['0.1.0-next.2', '0.1.0', '0.1.0-next.10', '0.0.9', '0.1.1-rc.1'].toSorted(newestFirst),
    ).toEqual(['0.1.1-rc.1', '0.1.0', '0.1.0-next.10', '0.1.0-next.2', '0.0.9']);
  });
});

describe('byPackageOrder', () => {
  it('puts the listed packages in their order and the rest after, by name', () => {
    expect(
      [
        '@isoloop/webmcp',
        '@isoloop/zeta',
        '@isoloop/bus',
        '@isoloop/alpha',
        '@isoloop/host',
      ].toSorted(byPackageOrder),
    ).toEqual([
      '@isoloop/host',
      '@isoloop/bus',
      '@isoloop/webmcp',
      '@isoloop/alpha',
      '@isoloop/zeta',
    ]);
  });
});

describe('isInternal', () => {
  it('reads the library\'s "Internal:" description', () => {
    expect(isInternal('Internal: the binary codec for Isoloop topic records.')).toBe(true);
    expect(isInternal('The Isoloop message bus: typed topics in a worker.')).toBe(false);
    expect(isInternal('Experimental devtools panel for Isoloop.')).toBe(false);
    expect(isInternal(undefined)).toBe(false);
  });
});

describe('loadChangelog', () => {
  const names = [
    'host',
    'runtime',
    'bus',
    'react',
    'preact',
    'vite',
    'cli',
    'devtools',
    'balancer',
    'webmcp',
  ];
  const files: Record<string, string> = {};
  for (const n of names) {
    const name = n === 'cli' ? 'isoloop' : `@isoloop/${n}`;
    files[`packages/${n}/package.json`] = JSON.stringify({ name, description: 'A package.' });
    files[`packages/${n}/CHANGELOG.md`] =
      `# ${name}\n\n## 0.1.0\n\nThe first release.\n\n## 0.1.0-next.1\n\n### Patch Changes\n\n- 1a2b3c4: A fix.\n`;
  }
  for (const n of ['codec', 'dom', 'protocol']) {
    files[`packages/${n}/package.json`] = JSON.stringify({
      name: `@isoloop/${n}`,
      description: 'Internal glue.',
    });
    files[`packages/${n}/CHANGELOG.md`] = '# x\n\n## 0.1.0\n\nInternal.\n';
  }
  const library = {
    read: (path: string) => files[path],
    list: () => Object.keys(files),
  };

  it('gives each of the 10 public packages its 0.1.0 entry, and leaves the internal ones out', () => {
    const { packages } = loadChangelog(library, 'sha');
    expect(packages).toHaveLength(10);
    for (const pkg of packages) {
      expect(
        pkg.releases.map((r) => r.version),
        pkg.name,
      ).toContain('0.1.0');
      expect(pkg.releases.find((r) => r.version === '0.1.0')?.intro).not.toEqual([]);
    }
  });
});
