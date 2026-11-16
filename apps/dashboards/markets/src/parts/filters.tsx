// The filters as a part (M3g decision 1): built apart on Preact by
// `vite build --mode native-mixed-parts`, loaded by the native + workers host.
import { FiltersBar } from '../widgets/FiltersBar';
import { withStress } from '../widgets/stress/withStress';
import { definePart } from './part';

export const mount = definePart(withStress('filters', FiltersBar));
