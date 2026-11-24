// The three builds of one source (M3d decision 7), as the page lists them.
export type BuildName = ImportMetaEnv['PLANT_BUILD'];

export const BUILDS: readonly { name: BuildName; label: string; summary: string }[] = [
  { name: 'isoloop', label: 'Isoloop', summary: 'Isoloop: widgets and engines in isolates' },
  { name: 'native', label: 'Native', summary: 'Native: everything on the main thread' },
  {
    name: 'native-workers',
    label: 'Native + workers',
    summary: 'Native + workers: a data worker per machine, widgets on the main thread',
  },
];

export const CURRENT: BuildName = import.meta.env.PLANT_BUILD;

/** The kernel switch's two sides (header): native builds and the Isoloop build. */
export type Side = 'native' | 'isoloop';
export const SIDE: Side = CURRENT === 'isoloop' ? 'isoloop' : 'native';

/** The builds the header offers on each side. */
export const SIDE_BUILDS: Record<Side, readonly { name: BuildName; short: string }[]> = {
  native: [
    { name: 'native', short: 'React' },
    { name: 'native-workers', short: 'React + workers' },
  ],
  isoloop: [{ name: 'isoloop', short: 'React' }],
};

/** Where the kernel switch goes: the other side's first build. */
export const OTHER_SIDE: BuildName = SIDE === 'isoloop' ? 'native' : 'isoloop';
