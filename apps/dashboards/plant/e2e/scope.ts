// Which builds a run covers (the CI strategy). `E2E_SCOPE=react` runs the
// fewer builds pull requests run on Firefox and WebKit (here: Isoloop and
// native); anything else runs all three.
export const FULL = process.env['E2E_SCOPE'] !== 'react';

export const BUILDS = ['isoloop', 'native', 'native-workers'] as const;

/** Isoloop and native, plus native + workers when the run is full. */
export const inScope = <T extends string>(builds: readonly T[]): T[] =>
  builds.filter((b) => FULL || b === 'isoloop' || b === 'native');

/**
 * Playwright's WebKit presents every frame a worker draws on a transferred
 * canvas through the page's main thread (engine constraint 2 in the Isoloop
 * repo, docs/investigations/engine-constraints.md). The eight waveforms scroll
 * every frame (M3d decision 4), and with them the Isoloop page stops running
 * its frames and timers there. Tests that need the page's main thread skip
 * that pair; webkit.spec.ts records the stop itself.
 */
export const WEBKIT_STOPS =
  'WebKit presents worker canvas frames on the main thread (engine constraint 2); the Isoloop page stops';

export const stopsOn = (browserName: string, build: string): boolean =>
  browserName === 'webkit' && build === 'isoloop';

/**
 * How long a test waits for a page's first data: 15 s, the later waits'
 * figure, and 45 s on Firefox. With 72 widgets starting on a 4-core CI
 * runner, the Isoloop build's first data in Firefox took 2.2 to 4.7 s in most
 * runs, and 14.5 s in one of five (run 44929464398, 2026-11-21); in others it
 * went past 15 s, with no isolate failing, and the page got there within 60 s.
 * Chromium and WebKit stay at 15 s. The tests that wait for it are marked
 * slow on Firefox, so the test timeout (30 s by default) covers it.
 */
export function firstData(browserName: string): number {
  return browserName === 'firefox' ? 45_000 : 15_000;
}
