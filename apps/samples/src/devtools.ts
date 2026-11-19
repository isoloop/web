import { createKernel } from '@isoloop/host';
import workers from 'virtual:isoloop/workers';

const kernel = createKernel({ workers });

// #region show
// main.ts: the panel is an isolate of its own, opened with its button or Alt+Shift+D
if (new URLSearchParams(location.search).get('devtools') === '1') {
  const { connectDevtools } = await import('@isoloop/devtools');
  connectDevtools(kernel, { position: 'bottom-right' });
}
// #endregion
