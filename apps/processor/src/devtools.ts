// `?devtools=1`: the devtools panel from `@isoloop/devtools`, as on the plant
// dashboard: a visual isolate in its own worker reading the kernel's
// inspection feed, opened in the corner with its button or Alt+Shift+D.
//
// The package is imported only with the flag, and only once the kernel exists
// (after Start, with ?start=manual), so a page without it runs no panel, no
// extra worker and no feed reader, and the comparison runs are unchanged.
import type { Kernel } from '@isoloop/host';
import { devtoolsRequested } from '../../../shared/devtools-switch';

export function connectDevtoolsIfAsked(kernel: Kernel): void {
  if (!devtoolsRequested()) return;
  void import('@isoloop/devtools').then(({ connectDevtools }) => connectDevtools(kernel));
}
