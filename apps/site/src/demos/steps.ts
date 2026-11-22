// The rail on /how-it-works/, /examples/ and /features/ (src/pages/steps.tsx):
// one panel at a time. Without JS every panel shows and the rail
// is a list of contents. With it, the panel the URL's hash names shows (the
// first one by default), so links, the back button and reloads keep it. A
// hash that names something inside a panel (a feature) shows that panel and
// scrolls to it; while reading, the rail marks the item the reader is at
// (src/demos/spy.ts).
import { startSpy, type Spy } from './spy.ts';

const stepOf = (a: HTMLAnchorElement): HTMLElement | null =>
  document
    .getElementById(decodeURIComponent(a.hash.slice(1)))
    ?.closest<HTMLElement>('[data-step]') ?? null;

export function startSteps(root: HTMLElement): void {
  const steps = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-rail] a[href^="#"]')];
  const fold = root.querySelector<HTMLDetailsElement>('.rail-fold');
  const foldText = root.querySelector<HTMLElement>('[data-rail-current]');
  const groupLinks = links.filter((a) => a.dataset['item'] === undefined);
  const itemLinks = links.filter((a) => a.dataset['item'] !== undefined);
  let spy: Spy | undefined;

  const show = (scroll: boolean): void => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    const step = target?.closest<HTMLElement>('[data-step]');
    const at = step ? steps.indexOf(step) : -1;
    const i = at < 0 ? 0 : at;
    steps.forEach((s, j) => {
      s.hidden = i !== j;
    });
    // Panels with items (features) mark the item; the others mark the panel's link.
    for (const a of groupLinks) {
      if (stepOf(a) === steps[i]) {
        if (!itemLinks.length) a.setAttribute('aria-current', 'step');
        if (foldText) foldText.textContent = a.textContent ?? '';
      } else a.removeAttribute('aria-current');
    }
    if (fold) fold.open = false;
    if (scroll && at >= 0 && target) {
      if (target !== step) target.scrollIntoView({ block: 'start' });
      else if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' });
    }
    if (spy) {
      if (target && target !== step) spy.hold(target);
      else spy.release();
    }
  };

  root.classList.add('steps-on');
  addEventListener('hashchange', () => show(true));
  show(location.hash.length > 1);
  if (itemLinks.length) {
    spy = startSpy(itemLinks, (el) => !el.closest<HTMLElement>('[data-step]')?.hidden);
    show(false);
  }
}
