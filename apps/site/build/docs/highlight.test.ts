// Fence names map to the tokenizer's languages (M4c, decision 8).
import { describe, expect, it } from 'vitest';
import { highlight } from './highlight.ts';

describe('highlight', () => {
  it('tokenizes json and html fences, not only ts', () => {
    expect(highlight('{ "ok": true }', 'json')).toContain('<span class="tok-');
    expect(highlight('<p class="a">x</p>', 'html')).toContain('<span class="tok-');
  });

  it('gives tsx and jsx fences the tsx tokenizer', () => {
    const code = '<button onClick={go}>Count</button>';
    expect(highlight(code, 'tsx')).toBe(highlight(code, 'jsx'));
    expect(highlight(code, 'tsx')).toContain('<span class="tok-');
  });

  it('leaves a language the tokenizer does not know plain', () => {
    expect(highlight('x', 'rust')).toBeNull();
  });
});
