import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mergeQueue, parseQueue, renderQueue, type MergedPr } from './queue-model.ts';

const pr = (n: number, impact: string, over: Partial<MergedPr> = {}): MergedPr => ({
  repo: 'isoloop/isoloop',
  number: n,
  title: `Change ${n}`,
  mergedAt: `2026-11-1${n % 10}T10:00:00Z`,
  author: 'dev',
  body: `## Summary\n\nStuff.\n\nSite impact: ${impact}\n`,
  ...over,
});

const render = (items: ReturnType<typeof mergeQueue>): string =>
  renderQueue(items, { since: '2026-11-17', footer: [] });

void test('adds a merged "update needed" PR as an open item', () => {
  const items = mergeQueue(new Map(), [pr(8, 'update needed'), pr(9, 'none')]);
  assert.equal(items.length, 1);
  assert.deepEqual(
    { ref: `${items[0]?.repo}#${items[0]?.number}`, done: items[0]?.done },
    { ref: 'isoloop/isoloop#8', done: false },
  );
});

void test('skips PRs with a missing or invalid Site impact line', () => {
  const items = mergeQueue(new Map(), [
    pr(8, 'update needed', { body: 'no line here' }),
    pr(9, 'maybe later'),
  ]);
  assert.equal(items.length, 0);
});

void test('render then parse round-trips, so re-runs are idempotent', () => {
  const first = render(mergeQueue(new Map(), [pr(7, 'update needed'), pr(8, 'update needed')]));
  const second = render(
    mergeQueue(parseQueue(first), [pr(7, 'update needed'), pr(8, 'update needed')]),
  );
  assert.equal(second, first);
});

void test('keeps a tick made by hand', () => {
  const body = render(mergeQueue(new Map(), [pr(8, 'update needed')])).replace('- [ ]', '- [x]');
  const items = mergeQueue(parseQueue(body), [pr(8, 'update needed')]);
  assert.equal(items[0]?.done, true);
});

void test('ticks an item whose PR now says "done in web#N", with that note', () => {
  const body = render(mergeQueue(new Map(), [pr(8, 'update needed')]));
  const items = mergeQueue(parseQueue(body), [pr(8, 'done in web#150')]);
  assert.equal(items[0]?.done, true);
  assert.equal(items[0]?.note, 'done in web#150');
  assert.match(
    render(items),
    /- \[x\] isoloop\/isoloop#8 · Change 8 · merged 2026-11-18 by @dev · done in web#150/,
  );
});

void test('ticks an item whose line changed to none, and never drops items', () => {
  const body = render(mergeQueue(new Map(), [pr(8, 'update needed')]));
  const items = mergeQueue(parseQueue(body), []);
  assert.equal(items.length, 1, 'an item not in this scan stays');
  const changed = mergeQueue(parseQueue(body), [pr(8, 'none')]);
  assert.equal(changed[0]?.done, true);
  assert.equal(changed[0]?.note, 'Site impact changed to none');
});

void test('a "done in web#N" PR that was never queued is not added', () => {
  assert.equal(mergeQueue(new Map(), [pr(8, 'done in web#150')]).length, 0);
});

void test('lists open items first, newest first, and keeps titles on one line', () => {
  const items = mergeQueue(new Map(), [
    pr(1, 'update needed', { title: 'Old · one' }),
    pr(5, 'update needed', { title: 'New\nline' }),
  ]);
  const body = render(items);
  assert.ok(body.indexOf('#5 · New line') < body.indexOf('#1 · Old - one'));
  assert.equal(parseQueue(body).size, 2);
});
