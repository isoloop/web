// The page URL, the same in both builds: the replay's settings, the filters
// (mirrored as they change), and where the replay is, so the toggle lands on
// the other build at the same place (M3b task 16).
import { EXCHANGES, SYMBOLS, type Filters } from './core/schemas';
import type { ReplayConfig } from './core/services';

/** `?speed=10&seed=7&tps=2&for=<ms>&at=<ms>`. */
export function replayConfig(params: URLSearchParams): ReplayConfig {
  const num = (k: string): number | undefined => {
    const v = Number(params.get(k));
    return params.has(k) && Number.isFinite(v) ? v : undefined;
  };
  const durationMs = num('for');
  const from = num('at');
  return {
    speed: num('speed') || 1,
    seed: num('seed') || 1,
    tradesPerSecond: num('tps') || 2,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(from === undefined ? {} : { from }),
  };
}

/** `?symbol=ETH-USD&ex=coinbase,okx&win=60000`, if the URL carries filters. */
export function filtersFrom(params: URLSearchParams): Filters | undefined {
  if (!params.has('symbol')) return undefined;
  const symbols = SYMBOLS.filter((s) => params.get('symbol')?.split(',').includes(s));
  const exchanges = EXCHANGES.filter((e) => params.get('ex')?.split(',').includes(e));
  const windowMs = Number(params.get('win'));
  if (symbols.length === 0 || exchanges.length === 0) return undefined;
  return {
    symbols,
    exchanges,
    windowMs: Number.isInteger(windowMs) && windowMs > 0 ? windowMs : 60_000,
  };
}

/** Mirrors the filters into the URL, without a reload or a history entry. */
export function writeFilters(f: Filters): void {
  const p = new URLSearchParams(location.search);
  p.set('symbol', f.symbols.join(','));
  p.set('ex', f.exchanges.join(','));
  p.set('win', String(f.windowMs));
  history.replaceState(history.state, '', `?${p.toString()}`);
}

let clock: { started: number; speed: number; from: number } | undefined;

/** Called when the build starts its replay. */
export function startReplayClock(c: ReplayConfig): void {
  clock = { started: performance.now(), speed: c.speed ?? 1, from: c.from ?? 0 };
}

/** Where the replay is in its recording, in ms; undefined on live feeds. */
export function replayPosition(): number | undefined {
  return clock && clock.from + (performance.now() - clock.started) * clock.speed;
}

/**
 * The other build's URL: the same settings and filters, at the replay's
 * position now; with `placement`, in that placement (an Isoloop build's).
 */
export function switchHref(other: string, placement?: PlacementName): string {
  const p = new URLSearchParams(location.search);
  const at = replayPosition();
  if (at !== undefined) p.set('at', String(Math.round(at)));
  if (placement !== undefined) {
    if (placement === DEFAULT_PLACEMENT) p.delete('placement');
    else p.set('placement', placement);
  }
  return `../${other}/?${p.toString()}`;
}

/**
 * Where the Isoloop builds run each isolate (M3f decision 3):
 * `?placement=own|matched|one`, and `teams` on `/mixed` only (M3g decision 7).
 * `own`, a worker per isolate, is the default: markets is the containment
 * example, and in a pool a block stalls every member. The native builds
 * ignore it.
 */
export const PLACEMENTS = ['own', 'matched', 'one', 'teams'] as const;
export type PlacementName = (typeof PLACEMENTS)[number];
export const DEFAULT_PLACEMENT: PlacementName = 'own';

/** The placements a build offers: `teams` needs two teams, so only `/mixed` has it. */
export const placementsFor = (build: string | undefined): readonly PlacementName[] =>
  build === 'mixed' ? PLACEMENTS : PLACEMENTS.filter((p) => p !== 'teams');

export const placementFrom = (
  params: URLSearchParams,
  build: string | undefined = import.meta.env.MARKETS_BUILD,
): PlacementName =>
  placementsFor(build).find((p) => p === params.get('placement')) ?? DEFAULT_PLACEMENT;

/** The current page's URL in another placement: the same settings, a fresh replay. */
export function placementHref(p: PlacementName, search: string): string {
  const q = new URLSearchParams(search);
  if (p === DEFAULT_PLACEMENT) q.delete('placement');
  else q.set('placement', p);
  q.delete('at');
  const s = q.toString();
  return s === '' ? '?' : `?${s}`;
}
