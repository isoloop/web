// `#env` in the parts' build: the same widget hooks, over the store the host
// passes to `mount`. The parts' bundle has its own copy of this module, so
// the host's store reaches it only through the contract.
import type { Source } from '../core/streams';
import type { Build } from '../env/canvas';
import { createHooks } from '../env/hooks';
import type { PartHost } from './contract';

let host: PartHost | undefined;

/** Called by `mount`: every part in this bundle reads the same host. */
export function connect(h: PartHost): void {
  host = h;
}

const useSource = (): Source => {
  if (!host) throw new Error('a part rendered before mount');
  return host;
};

export const { useLatest, useKeyed, useRecent, usePublish } = createHooks(useSource);

/** The parts render on the main thread, as the native builds do. */
export const BUILD: Build = 'native';

export { useBox, useCanvas } from '../env/dom';
