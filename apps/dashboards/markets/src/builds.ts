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
export const COUNTERPART: Record<BuildName, BuildName> = {
  isoloop: 'native',
  native: 'isoloop',
  'native-workers': 'isoloop',
  'isoloop-preact': 'native-preact',
  'native-preact': 'isoloop-preact',
  mixed: 'native',
};

export const CURRENT: BuildName = import.meta.env.MARKETS_BUILD;
