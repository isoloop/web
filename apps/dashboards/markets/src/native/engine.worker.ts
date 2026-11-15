// One shared engine in a worker of its own (native + workers).
import { ENGINES } from '../core/engines';
import { serve } from './worker-side';

serve((src, m) => {
  if (m.job === 'engine') ENGINES[m.engine](src);
});
