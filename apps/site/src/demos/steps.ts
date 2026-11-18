// The step tabs (src/pages/steps.tsx): one step at a time. Without JS every
// step shows and the tabs are a list of contents. With it, the step the URL's
// hash names shows (the first one by default), so links, the back button and
// reloads keep the step.
export function startSteps(root: HTMLElement): void {
  const steps = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const links = [...root.querySelectorAll<HTMLAnchorElement>('.steps-nav a')];
  const show = (scroll: boolean): void => {
    const id = decodeURIComponent(location.hash.slice(1));
    const at = steps.findIndex((s) => s.id === id);
    const i = at < 0 ? 0 : at;
    steps.forEach((s, j) => {
      s.hidden = i !== j;
    });
    links.forEach((a, j) => {
      if (i === j) {
        a.setAttribute('aria-current', 'step');
        a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else a.removeAttribute('aria-current');
    });
    // The hidden target couldn't be scrolled to: bring the step's top into view.
    if (scroll && at >= 0 && root.getBoundingClientRect().top < 0) {
      root.scrollIntoView({ block: 'start' });
    }
  };
  root.classList.add('steps-on');
  addEventListener('hashchange', () => show(true));
  show(location.hash.length > 1);
}
