// The replay source in a worker of its own (native + workers).
import { runReplay } from '../core/services';
import { serve } from './worker-side';

serve((src, m) => {
  if (m.job === 'replay') runReplay(src, m.config);
});
