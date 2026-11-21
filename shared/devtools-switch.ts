// The Devtools switch: one checkbox, the same on every page that runs Isoloop
// (the plant and markets Isoloop builds, their interactive pages, the
// processor pages). It shows and sets `?devtools=1` and reloads the page,
// since the panel starts with the kernel. Its look is `.ui-devtools-switch`
// in packages/ui's shell.css; the site's examples hub draws the same markup
// over its frames (apps/site/src/pages/examples.tsx).
//
// Each app connects the panel itself, lazily, when the flag is set: the
// package resolves from the app's own dependencies, not from here.

/** Whether this page asked for the devtools panel. */
export function devtoolsRequested(): boolean {
  try {
    return new URLSearchParams(location.search).get('devtools') === '1';
  } catch {
    return false;
  }
}

/** This page's URL with `?devtools=1` set or removed. */
export function withDevtools(href: string, on: boolean): string {
  const url = new URL(href, location.href);
  if (on) url.searchParams.set('devtools', '1');
  else url.searchParams.delete('devtools');
  return url.href;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The compact experimental mark, as packages/ui's ExperimentalMark draws it. */
function experimentalMark(label: string): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'ui-experimental-mark';
  mark.title = label;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const shape = (tag: string, attrs: Record<string, string>): void => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.append(e);
  };
  shape('circle', {
    cx: '8',
    cy: '8',
    r: '6.9',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
  });
  shape('path', {
    d: 'M8 4.3v4.5',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
  });
  shape('circle', { cx: '8', cy: '11.4', r: '1.05', fill: 'currentColor' });
  const sr = document.createElement('span');
  sr.className = 'ui-sr-only';
  sr.textContent = label;
  mark.append(svg, sr);
  return mark;
}

/** The switch, checked when the URL asks for devtools; changing it reloads the page with the flag. */
export function devtoolsSwitch(): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'ui-devtools-switch';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = devtoolsRequested();
  box.addEventListener('change', () => {
    location.assign(withDevtools(location.href, box.checked));
  });
  label.append(box, document.createTextNode('Devtools'), experimentalMark('Experimental'));
  return label;
}

/** Puts the switch at the end of `where`, once. */
export function mountDevtoolsSwitch(where: Element | null): void {
  if (!where || where.querySelector('.ui-devtools-switch')) return;
  where.append(devtoolsSwitch());
}
