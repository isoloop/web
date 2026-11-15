import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readResults, summarize } from 'compare/pairs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PLANT } from './run.ts';

// The recorded runs' summaries were written by the plant's own runner before
// it moved to packages/compare; the shared runner must rebuild them as they are.
const RECORDED = [
  'final/responsiveness',
  'matched/responsiveness',
  'matched/memory',
  'matched-v2/memory',
  'matched-q6/responsiveness',
];

describe('the shared runner on the plant', () => {
  it.each(RECORDED)('rebuilds %s/summary.md unchanged', (dir) => {
    const out = join(import.meta.dirname, dir);
    const meta: unknown = JSON.parse(readFileSync(join(out, 'run.json'), 'utf8'));
    const { args } = z
      .object({ args: z.object({ pair: z.array(z.string()), extra: z.array(z.string()) }) })
      .parse(meta);
    const pairs = args.pair.map((p) => {
      const [a = '', b = ''] = p.split('=');
      return { a, b };
    });
    const md = summarize(PLANT, readResults(PLANT, out), { pairs, extras: args.extra }, meta);
    expect(md).toBe(readFileSync(join(out, 'summary.md'), 'utf8'));
  });
});
