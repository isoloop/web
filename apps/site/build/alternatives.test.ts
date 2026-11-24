import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadAlternatives, MARK_COLUMNS, TEXT_COLUMNS } from './alternatives.ts';

const content = fileURLToPath(new URL('../content/alternatives.json', import.meta.url));
/** The real file, loose enough to break on purpose. */
interface Raw {
  rows: {
    betterFor?: string;
    ui: { mark: string };
    bus: { source: string };
    cost: { source?: string };
  }[];
}
// oxlint-disable-next-line typescript/no-unsafe-return -- test fixture, broken on purpose
const real = (): Raw => JSON.parse(readFileSync(content, 'utf8'));

function load(json: unknown) {
  const file = join(mkdtempSync(join(tmpdir(), 'alternatives-')), 'alternatives.json');
  writeFileSync(file, JSON.stringify(json));
  return loadAlternatives(file);
}

describe('content/alternatives.json', () => {
  it('is valid, Isoloop first, then the six alternatives', () => {
    expect(loadAlternatives(content).rows.map((r) => r.id)).toEqual([
      'isoloop',
      'remote-dom',
      'partytown',
      'worker-dom',
      'comlink',
      'iframes',
      'scheduler-yield',
    ]);
  });

  it('gives every cell a source and the date it was checked', () => {
    for (const row of loadAlternatives(content).rows) {
      for (const col of [...MARK_COLUMNS, ...TEXT_COLUMNS]) {
        expect(row[col].source, `${row.id}.${col}`).toMatch(/^(\/|https:\/\/)/);
        expect(row[col].checked, `${row.id}.${col}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("sources Isoloop's own row from the docs, not from other pages", () => {
    const isoloop = loadAlternatives(content).rows[0];
    for (const col of [...MARK_COLUMNS, ...TEXT_COLUMNS]) {
      expect(isoloop?.[col].source).toMatch(/^\/docs\//);
    }
  });
});

describe('loadAlternatives', () => {
  it('rejects a mark outside yes, partial and no', () => {
    const json = real();
    json.rows[1]!.ui.mark = 'maybe';
    expect(() => load(json)).toThrow(/rows\.1\.ui\.mark/);
  });

  it('rejects a cell without its source', () => {
    const json = real();
    delete json.rows[2]!.cost.source;
    expect(() => load(json)).toThrow(/rows\.2\.cost\.source/);
  });

  it('rejects an alternative that never says where it is the better choice', () => {
    const json = real();
    delete json.rows[3]?.betterFor;
    expect(() => load(json)).toThrow(/better choice/);
  });

  it('rejects a table that does not start with Isoloop', () => {
    const json = real();
    json.rows.reverse();
    expect(() => load(json)).toThrow(/Isoloop is the first row/);
  });

  it('rejects a source that is not https or a site path', () => {
    const json = real();
    json.rows[1]!.bus.source = 'http://example.com';
    expect(() => load(json)).toThrow(/rows\.1\.bus\.source/);
  });
});
