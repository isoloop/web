import { describe, expect, it } from 'vitest';
import { parseManifest } from './load';

describe('parseManifest', () => {
  it('reads each part’s entry and CSS', () => {
    expect(
      parseManifest({
        parts: {
          filters: { entry: 'filters-a1.js' },
          'alerts-panel': { entry: 'a.js', css: ['a.css'] },
        },
      }),
    ).toEqual({
      filters: { entry: 'filters-a1.js' },
      'alerts-panel': { entry: 'a.js', css: ['a.css'] },
    });
  });

  it('rejects a manifest without parts, or a part without an entry', () => {
    expect(() => parseManifest({ isolates: {} })).toThrow();
    expect(() => parseManifest({ parts: { filters: { css: [] } } })).toThrow();
  });
});
