// One exchange's live feed in a worker of its own (native + workers, `?source=live`).
import { feeds } from '../core/feeds';
import { runLiveFeed } from '../core/services';
import { serve } from './worker-side';

serve((src, m) => {
  if (m.job !== 'feed') return;
  const feed = feeds.find((f) => f.exchange === m.exchange);
  if (feed) runLiveFeed(src, feed);
});
