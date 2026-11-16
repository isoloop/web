// The interactive page's URL: `?rate=1|2|5` (vibration sampling, kHz) and
// `?seed=`, as plant's page reads them; no placement (M3e decision 5).
import { settingsFrom } from '../url';

export const KIND: 'isoloop' | 'native' =
  import.meta.env.PLANT_BUILD === 'isoloop' ? 'isoloop' : 'native';

const read = settingsFrom(
  new URLSearchParams(typeof location === 'undefined' ? '' : location.search),
);
export const SETTINGS = { rate: read.rate, seed: read.seed };
