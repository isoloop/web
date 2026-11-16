// The interactive page's URL: `?rate=1|2|5` (vibration sampling, kHz) and
// `?seed=`, as plant's page reads them; no placement (M3e decision 5).
// `?chaos` offers the test-only `burn` operator in the drawer (M3h decision 21).
import { settingsFrom } from '../url';

export const KIND: 'isoloop' | 'native' =
  import.meta.env.PLANT_BUILD === 'isoloop' ? 'isoloop' : 'native';

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const read = settingsFrom(params);
export const SETTINGS = { rate: read.rate, seed: read.seed, chaos: params.has('chaos') };
