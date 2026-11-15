import { createRoot } from 'react-dom/client';
import { feeds } from './core/feeds';
import { startWorkers } from './native/workers';
import { store } from './native/store';
import { Page } from './page';
import { replayFor, specFrom } from './sizes/sizes';
import { filtersFrom, startReplayClock, writeFilters } from './url';
import './page.css';
import './widgets/widgets.css';

declare global {
  interface Window {
    /** For the E2E suite: the native builds' store. */
    store: typeof store;
  }
}
window.store = store;

// The native + workers build (M3f decision 2): the same jobs as the Isoloop
// build's headless isolates, each in a plain worker of its own; the widgets
// on the main thread, reading the page's store.
const params = new URLSearchParams(location.search);
// Filters from the URL (after a switch), and back into it as they change.
// Published before the workers start, so the aggregator's relay carries them.
const initial = filtersFrom(params);
if (initial) store.publish('filters', initial, 'current');
store.subscribe(
  'filters',
  (r) => {
    writeFilters(r.value);
  },
  'latest',
);
const live = params.get('source') === 'live';
const config = replayFor(params);
startWorkers({
  source: live ? { live: feeds.map((f) => f.exchange) } : { replay: config },
  engines: specFrom(params).engines,
});
if (!live) startReplayClock(config);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<Page />);
