// The widgets' environment in the native build: streams come from the
// page's store, and a chart draws on its own <canvas> on the main thread.
import type { Source } from '../core/streams';
import { store } from '../native/store';
import type { Build } from './canvas';
import { createHooks } from './hooks';

const useSource = (): Source => store;

export const { useLatest, useKeyed, useRecent, usePublish } = createHooks(useSource);

/** The build these hooks run in, for the metrics panel. */
export const BUILD: Build = 'native';

export { useBox, useCanvas } from './dom';
