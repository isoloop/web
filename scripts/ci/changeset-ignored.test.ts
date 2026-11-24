import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { findings, ignoreList, packagesOf, readChangesets } from './changeset-ignored.ts';

const IGNORE = ['ui', 'creator', 'compare', 'samples', 'plant-bench'];
const cs = (front: string): string => `---\n${front}\n---\n\nSome change.\n`;

void describe('packagesOf', () => {
  void it('reads quoted and bare names', () => {
    assert.deepEqual(packagesOf(cs(`'ui': patch\n"site": minor\nplant: patch`)), [
      'ui',
      'site',
      'plant',
    ]);
  });
  void it('returns null without front matter', () => {
    assert.equal(packagesOf('No front matter.'), null);
  });
  void it('reads an empty changeset as no packages', () => {
    assert.deepEqual(packagesOf('---\n---\n\nEmpty.\n'), []);
  });
});

void describe('findings', () => {
  void it('flags ui beside an app, as in web#278', () => {
    assert.deepEqual(findings([{ file: 'a.md', text: cs(`'ui': patch\n'site': patch`) }], IGNORE), [
      { file: 'a.md', ignored: ['ui'], versioned: ['site'] },
    ]);
  });
  void it('flags a changeset that names only ignored packages, with nothing versioned', () => {
    assert.deepEqual(findings([{ file: 'b.md', text: cs(`'ui': patch`) }], IGNORE), [
      { file: 'b.md', ignored: ['ui'], versioned: [] },
    ]);
  });
  void it('passes apps only', () => {
    assert.deepEqual(
      findings([{ file: 'c.md', text: cs(`'site': patch\n'plant': minor`) }], IGNORE),
      [],
    );
  });
});

void describe('the repo', () => {
  void it('reads the ignore list this check assumes', () => {
    const ignore = ignoreList(JSON.parse(readFileSync('.changeset/config.json', 'utf8')));
    assert.deepEqual(ignore.toSorted(), IGNORE.toSorted());
  });
  void it('has no changeset that changeset version would refuse', () => {
    const mixed = findings(readChangesets(), IGNORE).filter((f) => f.versioned.length > 0);
    assert.deepEqual(mixed, []);
  });
});
