// The tabs on /how-it-works/, /examples/ and /features/ (src/pages/steps.tsx,
// src/pages/features.tsx, ADR 0005): one step at a time. Without JS every
// step shows and the tabs are a list of contents. With it, the step the URL's
// hash names shows (the first one by default), so links, the back button and
// reloads keep the step. A hash that names something inside a step (a feature
// on /features/) shows that step and scrolls to it.
export function startSteps(root: HTMLElement): void {
  const steps = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('.steps-nav a')];
  const show = (scroll: boolean): void => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    const step = target?.closest<HTMLElement>('[data-step]');
    const at = step ? steps.indexOf(step) : -1;
    const i = at < 0 ? 0 : at;
    steps.forEach((s, j) => {
      s.hidden = i !== j;
    });
    links.forEach((a, j) => {
      if (i === j) {
        a.setAttribute('aria-current', 'step');
        intoBar(a);
      } else a.removeAttribute('aria-current');
    });
    if (!scroll || at < 0 || !target) return;
    // The hidden target couldn't be scrolled to: bring it into view now.
    if (target !== step) target.scrollIntoView({ block: 'start' });
    else if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' });
  };
  root.classList.add('steps-on');
  addEventListener('hashchange', () => show(true));
  show(location.hash.length > 1);
}

/** Scrolls the tab row sideways to show the tab; scrollIntoView would move the page too. */
function intoBar(a: HTMLElement): void {
  const row = a.closest('ol');
  if (!row) return;
  const left = a.offsetLeft - row.offsetLeft;
  if (left < row.scrollLeft) row.scrollLeft = left;
  else if (left + a.offsetWidth > row.scrollLeft + row.clientWidth)
    row.scrollLeft = left + a.offsetWidth - row.clientWidth;
}
