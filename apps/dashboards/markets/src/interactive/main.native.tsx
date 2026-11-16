// The interactive page on the main thread: the same replay, aggregator and
// stats engine into a markets store, and the board on the native runtime, fed
// from the store.
import { nativeRuntime } from 'creator/board';
import { createRoot } from 'react-dom/client';
import { runStats } from '../core/engines';
import { runAggregator, runReplay } from '../core/services';
import { Store } from '../native/store';
import { nativeSources } from './native';
import { InteractivePage } from './page';
import { REPLAY } from './url';
import '../page.css';
import './interactive.css';

// No storage: markets' page keeps its alert rules and alerts in
// localStorage, and this page doesn't write to them (contracts.ts).
const store = new Store();
declare global {
  interface Window {
    /** For the E2E suite: the page's store. */
    store: Store;
  }
}
window.store = store;

// The sources start keeping the offered topics before the jobs publish.
const sources = nativeSources(store);
runReplay(store, REPLAY);
runAggregator(store);
runStats(store);

const runtime = nativeRuntime({ storageKey: 'markets', sources });
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<InteractivePage runtime={runtime} />);
