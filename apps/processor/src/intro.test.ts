// The playground's intro (example.json, shared with the site's examples hub)
// states the balancer's thresholds as numbers: they must be the ones the page
// and the balancer use.
import { describe, expect, it } from 'vitest';
import type { IntroBlock } from '../../../shared/intro';
import example from '../example.json' with { type: 'json' };
import { SPIKE_MS, SUSTAINED_MS } from './ui';

const text = (id: string): string =>
  ((example.embeds.find((e) => e.id === id)?.intro ?? []) as IntroBlock[])
    .map((b) => (typeof b === 'string' ? b : b.list.join(' ')))
    .join(' ');

describe('the intros in example.json', () => {
  it('give the playground the balancer thresholds the page draws', () => {
    const t = text('processor-playground');
    expect(t).toContain(`over ${String(SUSTAINED_MS)} ms of lag`);
    expect(t).toContain(`past ${String(SPIKE_MS)} ms`);
  });
  it('exist for both pages', () => {
    expect(text('processor-playground')).not.toBe('');
    expect(text('processor-files')).not.toBe('');
  });
});
