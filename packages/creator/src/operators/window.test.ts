import { describe, expect, it } from 'vitest';
import { rec } from '../test-fixtures';
import { RecordWindow } from './window';

const ts = (recs: { t: number }[]) => recs.map((r) => r.t);

describe('RecordWindow', () => {
  it('a time window holds the last ms, ending at the time asked', () => {
    const w = new RecordWindow({ ms: 1000 });
    for (const t of [0, 500, 1000, 1500, 2000]) w.push(rec(t, 'k', {}));
    expect(ts(w.at(2000))).toEqual([1500, 2000]);
    expect(ts(w.at(1000))).toEqual([500, 1000]);
  });

  it('a count window holds the last n up to the time asked', () => {
    const w = new RecordWindow({ n: 2 });
    for (const t of [0, 1, 2, 3]) w.push(rec(t, 'k', {}));
    expect(ts(w.at(3))).toEqual([2, 3]);
    expect(ts(w.at(1))).toEqual([0, 1]);
  });

  it('evicts only what no later window can see', () => {
    const time = new RecordWindow({ ms: 1000 });
    for (const t of [0, 500, 1000, 1500]) time.push(rec(t, 'k', {}));
    time.evict(1500);
    expect(ts(time.at(1500))).toEqual([1000, 1500]);
    expect(time.oldest()).toBe(1000);

    const count = new RecordWindow({ n: 2 });
    for (const t of [0, 1, 2, 3, 4]) count.push(rec(t, 'k', {}));
    count.evict(2);
    expect(ts(count.at(2))).toEqual([1, 2]);
    expect(ts(count.at(4))).toEqual([3, 4]);
    expect(count.oldest()).toBe(1);
  });

  it('without a shape, keeps the newest records up to its limit', () => {
    const w = new RecordWindow(null, 3);
    for (const t of [0, 1, 2, 3, 4]) w.push(rec(t, 'k', {}));
    expect(ts(w.at(10))).toEqual([2, 3, 4]);
  });
});
