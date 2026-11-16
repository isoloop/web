import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { summarize, type Result } from 'compare/pairs';
import { describe, expect, it } from 'vitest';
import { INTERACTIVE } from './interactive.ts';

// The interactive page's runner and its spec agree: every figure the summary
// reads is one the spec writes, and a pair summarizes.
const SPEC = readFileSync(join(import.meta.dirname, '../e2e/interactive-compare.spec.ts'), 'utf8');

const result = (build: string, run: number, typing: number): Result => ({
  engine: 'chromium',
  build,
  placement: null,
  value: 5,
  stopped: false,
  figures: { typingMedianMs: typing },
  run,
  key: build,
});

describe('the interactive head-to-head', () => {
  it.each(INTERACTIVE.figures.map((f) => f.key))('the spec writes %s', (key) => {
    expect(SPEC).toMatch(new RegExp(`\\b${key}[:,]`));
  });

  it('runs on the interactive projects only', () => {
    expect(Object.values(INTERACTIVE.projects)).toEqual([
      'interactive-comparison',
      'interactive-comparison-firefox',
    ]);
  });

  it('summarizes a native–Isoloop pair', () => {
    const md = summarize(
      INTERACTIVE,
      [
        result('native', 1, 10),
        result('isoloop', 1, 40),
        result('native', 2, 12),
        result('isoloop', 2, 44),
      ],
      { pairs: [{ a: 'native', b: 'isoloop' }], extras: [] },
      null,
    );
    expect(md).toContain('Drawer typing (median of 10)');
    expect(md).toContain('5 kHz');
  });
});
