// A plain Isoloop isolate served from another origin, with one static import:
// checks whether Firefox's worker-src rule is specific to Module Federation.
import { label } from './y.js';
export default {
  start(ctx) {
    const p = ctx.root.ownerDocument.createElement('p');
    p.setAttribute('data-where', '');
    p.textContent = label;
    ctx.root.append(p);
  },
};
