// Which builds a run covers (the CI strategy). `E2E_SCOPE=react` runs the React
// builds only (Isoloop, native, native + workers), as pull requests do on
// Firefox and WebKit; anything else runs all six builds.
export const FULL = process.env['E2E_SCOPE'] !== 'react';

const REACT: ReadonlySet<string> = new Set(['isoloop', 'native', 'native-workers']);

/** The React builds, plus the rest when the run is full. */
export const inScope = <T extends string>(builds: readonly T[]): T[] =>
  builds.filter((b) => FULL || REACT.has(b));
