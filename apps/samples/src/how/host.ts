// /how-it-works/, "The host and its isolates": a host with one isolate.
declare const counterEl: Element;

// #region show
import { createKernel } from '@isoloop/host';
import workers from 'virtual:isoloop/workers'; // the worker files @isoloop/vite builds
import list from '../topics';
import contractsUrl from '../topics?isolate';
import counter from '../counter-vanilla?isolate';

const kernel = createKernel({ contracts: { url: contractsUrl, list }, workers });

kernel.spawn({
  id: 'counter',
  src: counter,
  surface: counterEl, // leave it out for a headless isolate
  grants: { publish: ['count.v1'], subscribe: ['count.v1'] },
});
// #endregion

export default kernel;
