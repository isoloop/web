// /examples/: one panel per example page in the rail (steps.ts), and the
// examples that run on the page (src/pages/examples.tsx). Each is
// a frame of the app with ?embed=1&start=manual, idle, under a Start cover.
// Start removes the cover and tells the frame to start, now and again when
// it says it's idle (shared/manual-start.ts; same origin only).
// Leaving its panel reloads the frame idle and puts the cover back, so nothing
// runs unseen. Where the page takes ?devtools=1, a Devtools switch over the
// frame reloads it idle with the flag added or removed (the panel starts with
// the app, on Start), carries the flag to Open full page, and gives the frame
// room for the panel.
import { startSteps } from './steps.ts';

const START = 'isoloop-example:start';
const IDLE = 'isoloop-example:idle';

const root = document.querySelector<HTMLElement>('[data-steps]');
if (root) startSteps(root);

/** Extra frame height while devtools is on, for its panel docked at the bottom. */
const DEVTOOLS_ROOM = 420;

/** `url` with `?devtools=1` set or removed; same-origin paths stay paths. */
const withDevtools = (url: string, on: boolean): string => {
  const u = new URL(url, location.href);
  if (on) u.searchParams.set('devtools', '1');
  else u.searchParams.delete('devtools');
  return u.pathname + u.search + u.hash;
};

interface Live {
  figure: HTMLElement;
  frame: HTMLIFrameElement;
  cover: HTMLElement;
  src: string;
  idle: boolean;
  started: boolean;
}

const lives: Live[] = [];
for (const figure of document.querySelectorAll<HTMLElement>('[data-live]')) {
  const frame = figure.querySelector('iframe');
  const cover = figure.querySelector<HTMLElement>('.ex-live-cover');
  const button = cover?.querySelector('button');
  if (!frame || !cover || !button) continue;
  const live: Live = {
    figure,
    frame,
    cover,
    src: frame.getAttribute('src') ?? '',
    idle: false,
    started: false,
  };
  cover.hidden = false;
  button.addEventListener('click', () => {
    live.started = true;
    cover.hidden = true;
    // Sent now in any case (a frame that said it was idle before this script
    // listened is waiting for it); a frame still loading gets it on its idle.
    frame.contentWindow?.postMessage({ type: START }, location.origin);
    frame.focus();
  });
  lives.push(live);

  const box = figure.querySelector<HTMLInputElement>('input[data-devtools]');
  const open = figure.querySelector<HTMLAnchorElement>('a[data-open]');
  if (box) {
    const height = Number(frame.getAttribute('height') ?? '900');
    box.closest('label')?.removeAttribute('hidden');
    box.addEventListener('change', () => {
      live.src = withDevtools(live.src, box.checked);
      if (open) open.href = withDevtools(open.getAttribute('href') ?? '', box.checked);
      frame.setAttribute('height', String(height + (box.checked ? DEVTOOLS_ROOM : 0)));
      reset(live, true);
    });
  }
}

/** Back to idle under the cover: the frame reloads, nothing runs until Start. */
function reset(live: Live, always = false): void {
  if (!live.started && !always) return;
  live.started = false;
  live.idle = false;
  live.cover.hidden = false;
  // Navigating the frame's own window reloads it now: setting src on a lazy
  // frame in a hidden panel would wait until it's shown, leaving it running.
  try {
    live.frame.contentWindow?.location.replace(live.src);
  } catch {
    live.frame.src = live.src;
  }
}

addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const type: unknown =
    typeof e.data === 'object' && e.data !== null ? Reflect.get(e.data, 'type') : undefined;
  if (type !== IDLE) return;
  const live = lives.find((l) => l.frame.contentWindow === e.source);
  if (!live) return;
  live.idle = true;
  if (live.started) live.frame.contentWindow?.postMessage({ type: START }, location.origin);
});

// After steps.ts has shown the new panel (its listener was added first).
addEventListener('hashchange', () => {
  for (const live of lives)
    if (live.figure.closest<HTMLElement>('[data-step]')?.hidden) reset(live);
});
