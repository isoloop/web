// The aggregator in a worker of its own (native + workers).
import { runAggregator } from '../core/services';
import { serve } from './worker-side';

serve((src, m) => {
  if (m.job === 'aggregator') runAggregator(src);
});
