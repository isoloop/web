// The interactive page on the main thread: the same feeds and engines into
// plant's store, and the board on the native runtime, fed from the store.
import { nativeRuntime } from 'creator/board';
import { createRoot } from 'react-dom/client';
import { runFft, runFleet, runHealth } from '../core/engines';
import { MACHINES } from '../core/machines';
import { runFeed } from '../core/sensors/feed';
import { Store } from '../core/store';
import { nativeSources } from './native';
import { InteractivePage } from './page';
import { SETTINGS } from './url';
import '../page.css';
import './interactive.css';

// No storage: plant's main page keeps its alarms and events in localStorage,
// and this page doesn't write to its history (contracts.ts).
const store = new Store();
declare global {
  interface Window {
    /** For the E2E suite: the page's store. */
    store: Store;
  }
}
window.store = store;

for (const machine of MACHINES) {
  runFeed(store, { machine, seed: SETTINGS.seed, rateKHz: SETTINGS.rate });
  runFft(store, machine, SETTINGS.rate);
  runHealth(store, machine);
}
runFleet(store);

const runtime = nativeRuntime({ storageKey: 'plant', sources: nativeSources(store) });
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<InteractivePage runtime={runtime} />);
