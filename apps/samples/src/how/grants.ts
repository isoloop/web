// /how-it-works/, "Grants and safety": exact topics, a pattern, and navigation.
import type { Kernel } from '@isoloop/host';

declare const kernel: Kernel;
declare const surface: Element;
declare const machineUrl: string;

// #region show
kernel.spawn({
  id: 'machine-3',
  src: machineUrl,
  surface,
  grants: {
    publish: ['machine.3.*'], // machine.3.temp.v1, machine.3.alarms.v1, …
    subscribe: ['machine.3.*', 'count.v1'],
    navigate: true, // may call ctx.host.navigate; plain link clicks need no grant
  },
});
// #endregion
