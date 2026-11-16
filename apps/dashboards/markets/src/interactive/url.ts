// The interactive page's URL: `?size=lite|normal|heavy` (the replay's symbols
// and rate, as on markets' page) and its replay settings (`?seed=`, `?tps=`,
// `?speed=`); no build or placement (M3e decision 5). `?chaos` offers the
// test-only `burn` operator in the drawer (M3h decision 21).
import { replayFor, sizeOf, type Size } from '../sizes/sizes';

export const KIND: 'isoloop' | 'native' =
  import.meta.env.MARKETS_BUILD === 'isoloop' ? 'isoloop' : 'native';

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const SIZE: Size = sizeOf(params);
export const REPLAY = replayFor(params);
export const CHAOS = params.has('chaos');
