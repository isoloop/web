// The entry. It loads only where the page's browser check passed
// (shared/browser-check.ts); otherwise the page's notice names what's missing.
// With `?start=manual` (the site's examples hub) the page draws idle panes and
// starts the kernel only when told to (shared/manual-start.ts).
import '../../../shared/guard.ts';
import './page.css';
import { manualStart, whenStarted } from '../../../shared/manual-start.ts';
import { LAYOUT } from './layout';
import { createPane } from './panes';

if (manualStart) {
  await import('../../../shared/booted.ts');
  const idle = LAYOUT.map((slot) => {
    const parent = document.getElementById(slot.parent);
    if (!parent) throw new Error(`#${slot.parent} missing`);
    createPane(parent, slot);
    return parent;
  });
  await whenStarted(
    document.querySelector('.loops'),
    'Nothing runs yet. Start creates the kernel, the bus and the four isolates.',
  );
  for (const parent of new Set(idle)) parent.replaceChildren();
  await import('./app.ts');
} else {
  await import('./app.ts');
  await import('../../../shared/booted.ts');
}
