import { describe, expect, it } from 'vitest';
import { SPECS } from './sizes/sizes';
import { poolOf, whereOf, workersOf, type Kind } from './placement';

/** A size's isolates: its widgets, the replay, the aggregator, the alerts and its engines. */
const kinds = (size: keyof typeof SPECS): Kind[] => [
  ...SPECS[size].widgets.map((): Kind => 'widget'),
  ...['replay', 'aggregator', 'alerts', ...SPECS[size].engines].map((): Kind => 'data'),
];

describe('placements', () => {
  it('pools widgets in matched, everything in one, nothing in own', () => {
    expect(poolOf('own', 'widget')).toBeUndefined();
    expect(poolOf('own', 'data')).toBeUndefined();
    expect(poolOf('matched', 'widget')).toBe('widgets');
    expect(poolOf('matched', 'data')).toBeUndefined();
    expect(poolOf('one', 'widget')).toBe('all');
    expect(poolOf('one', 'data')).toBe('all');
  });

  it('pools each team in teams, the data on its own workers', () => {
    expect(poolOf('teams', 'widget', 'react')).toBe('react');
    expect(poolOf('teams', 'widget', 'preact')).toBe('preact');
    expect(poolOf('teams', 'data')).toBeUndefined();
    // /mixed at Normal: 14 React widgets and the two Preact ones (filters, alerts).
    const widgets = SPECS.normal.widgets.map((w) => ({
      kind: 'widget' as const,
      framework:
        w.widget === 'filters' || w.widget === 'alerts-panel'
          ? ('preact' as const)
          : ('react' as const),
    }));
    const data = kinds('normal').filter((k) => k === 'data');
    expect(workersOf('teams', [...widgets, ...data])).toBe(8);
  });

  it('counts the workers each runs, the bus left out', () => {
    expect(workersOf('own', kinds('normal'))).toBe(22);
    expect(workersOf('own', kinds('heavy'))).toBe(30);
    // The native + workers build's 6 data workers, plus one for the widgets.
    expect(workersOf('matched', kinds('normal'))).toBe(7);
    expect(workersOf('matched', kinds('heavy'))).toBe(7);
    expect(workersOf('one', kinds('heavy'))).toBe(1);
  });

  it('labels a pool by name and an own worker by number', () => {
    expect(whereOf('widgets', 0)).toBe('pool widgets');
    expect(whereOf(undefined, 12)).toBe('worker 12');
  });
});
