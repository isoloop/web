// The alert engine in a worker of its own (native + workers).
import { runAlerts } from '../core/services';
import { serve } from './worker-side';

serve((src, m) => {
  if (m.job === 'alerts') runAlerts(src);
});
