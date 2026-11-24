// The dashboards' opt-in extras (M4b task 11): the devtools panel
// (`?devtools=1`) and WebMCP (a browser that has it). Both are imported lazily,
// so a page without them never loads their code. Their output files are named
// `opt-in-*`, so each app's build-stats.ts leaves them out of the build's
// JavaScript figure, which stays what a visitor without them downloads.

/** The prefix of an opt-in output file. */
export const OPT_IN_PREFIX = 'opt-in-';

const OPT_IN = /[\\/]@isoloop[\\/](?:devtools|webmcp)[\\/]/;

type Chunk = { facadeModuleId: string | null };
type Asset = { originalFileNames?: readonly string[] };

/** Rolldown output names: Vite's defaults, with `opt-in-` for those packages' files. */
export const optInOutput = {
  chunkFileNames: (c: Chunk): string =>
    c.facadeModuleId !== null && OPT_IN.test(c.facadeModuleId)
      ? `assets/${OPT_IN_PREFIX}[name]-[hash].js`
      : 'assets/[name]-[hash].js',
  assetFileNames: (a: Asset): string =>
    (a.originalFileNames ?? []).some((f) => OPT_IN.test(f))
      ? `assets/${OPT_IN_PREFIX}[name]-[hash][extname]`
      : 'assets/[name]-[hash][extname]',
};
