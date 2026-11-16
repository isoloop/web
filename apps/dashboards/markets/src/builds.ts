// The six builds of one source (M3b tasks 15 and 16b, M3f decision 2), as the page lists them.
export type BuildName = ImportMetaEnv['MARKETS_BUILD'];

export const BUILDS: readonly { name: BuildName; label: string }[] = [
  { name: 'isoloop', label: 'Isoloop · React' },
  { name: 'native', label: 'Native · React' },
  { name: 'native-workers', label: 'Native + workers · React' },
  { name: 'isoloop-preact', label: 'Isoloop · Preact' },
  { name: 'native-preact', label: 'Native · Preact' },
  { name: 'mixed', label: 'Isoloop · React and Preact' },
];

/**
 * The build the toggle switches to: the same framework, the other kernel.
 * Native + workers switches to the Isoloop placement that matches it.
 */
export const COUNTERPART: Record<BuildName, BuildName | undefined> = {
  isoloop: 'native',
  native: 'isoloop',
  'native-workers': 'isoloop',
  'isoloop-preact': 'native-preact',
  'native-preact': 'isoloop-preact',
  // React and Preact isolates on one page has no native counterpart: the
  // kernel switch shows Native as unavailable there.
  mixed: undefined,
};

export const CURRENT: BuildName = import.meta.env.MARKETS_BUILD;

/** The kernel switch's two sides (header): native builds and Isoloop builds. */
export type Side = 'native' | 'isoloop';
export const SIDE: Side = CURRENT.startsWith('native') ? 'native' : 'isoloop';

/**
 * The builds the header offers on each side, by framework. `mixed` is React
 * and Preact isolates on one page, shown in its own colour.
 */
export const SIDE_BUILDS: Record<
  Side,
  readonly { name: BuildName; short: string; mixed?: true }[]
> = {
  native: [
    { name: 'native', short: 'React' },
    { name: 'native-workers', short: 'React + workers' },
    { name: 'native-preact', short: 'Preact' },
  ],
  isoloop: [
    { name: 'isoloop', short: 'React' },
    { name: 'isoloop-preact', short: 'Preact' },
    { name: 'mixed', short: 'React + Preact', mixed: true },
  ],
};
