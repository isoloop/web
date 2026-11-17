import { describe, expect, it } from 'vitest';
import { absoluteLinks, newestFirst, parseChangelog } from './changelog.ts';

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

  it('skips sections that are not versions', () => {
    expect(parseChangelog('# site\n\n## Earlier releases\n\nTags.\n')).toEqual([]);
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
