// /examples/: one panel per example page in the rail (steps.ts), and the
// examples that run on the page (src/pages/examples.tsx). Each is
// a frame of the app with ?embed=1&start=manual, idle, under a Start cover.
// Start removes the cover and tells the frame to start, now and again when
// it says it's idle (shared/manual-start.ts; same origin only).
// Leaving its panel reloads the frame idle and puts the cover back, so nothing
// runs unseen.
import { startSteps } from './steps.ts';

const START = 'isoloop-example:start';
const IDLE = 'isoloop-example:idle';

const root = document.querySelector<HTMLElement>('[data-steps]');
if (root) startSteps(root);

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
  for (const live of lives) {
    if (!live.started || !live.figure.closest<HTMLElement>('[data-step]')?.hidden) continue;
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
});
