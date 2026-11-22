// The scroll-spy shared by "On this page" (src/demos/docs.ts) and the features
// rail (src/demos/steps.ts): marks the link whose heading the reader is at.
//
// - A heading is current once its top passes a third of the window; before
//   the first one, the first one is.
// - Near the end, headings that can never reach that line share out the last
//   window's height of scroll evenly, so each is current in turn and the last
//   one is current at the very bottom.
// - A click on a link (or a hash change to it) makes it current at once and
//   keeps it so until the reader scrolls by themselves; the scroll the jump
//   causes is ignored.

export interface Spy {
  /** Marks the current link again, e.g. after a panel was shown or hidden. */
  refresh(): void;
  /** Makes the link to `el` current until the reader scrolls. */
  hold(el: HTMLElement): void;
  /** Lets go of a held link and marks by position again. */
  release(): void;
}

const USER_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

const idOf = (a: HTMLAnchorElement): string => decodeURIComponent(a.hash.slice(1));

/** The scroll position at which each target becomes current. */
const positions = (targets: HTMLElement[]): number[] => {
  const line = innerHeight / 3;
  const max = document.documentElement.scrollHeight - innerHeight;
  const at = targets.map((el) => el.getBoundingClientRect().top + scrollY - line);
  if (!at.length || at[at.length - 1]! <= max) return at;
  // The tail can't reach the line: spread every heading past `from` evenly
  // over the last window of scroll, the last one at the bottom.
  const from = Math.max(0, max - innerHeight);
  const first = at.findIndex((p) => p > from);
  const n = at.length - first;
  return at.map((p, i) => (i < first ? p : from + ((i - first + 1) * (max - from)) / n));
};

export function startSpy(
  links: HTMLAnchorElement[],
  shown: (el: HTMLElement) => boolean = () => true,
): Spy {
  const all = [
    ...new Set(
      links.map((a) => document.getElementById(idOf(a))).filter((el): el is HTMLElement => !!el),
    ),
  ];
  let held: HTMLElement | null = null;

  const mark = (el: HTMLElement | undefined): void => {
    for (const a of links) {
      if (el && idOf(a) === el.id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  };

  const update = (): void => {
    if (held) return mark(held);
    const targets = all.filter(shown);
    if (!targets.length) return mark(undefined);
    const pos = positions(targets);
    const y = scrollY + 1;
    let i = 0;
    pos.forEach((p, j) => {
      if (p <= y) i = j;
    });
    mark(targets[i]);
  };

  let ticking = false;
  addEventListener(
    'scroll',
    () => {
      if (held || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    },
    { passive: true },
  );
  addEventListener('resize', update);

  // The reader scrolling by themselves releases a held link.
  const release = (): void => {
    if (!held) return;
    held = null;
    requestAnimationFrame(update);
  };
  addEventListener('wheel', release, { passive: true });
  addEventListener('touchmove', release, { passive: true });
  addEventListener('keydown', (e) => {
    if (USER_KEYS.has(e.key) && !(e.target instanceof HTMLInputElement)) release();
  });
  // A press outside the links (a scrollbar drag, a text selection).
  addEventListener('pointerdown', (e) => {
    const { target } = e;
    if (!(target instanceof Element && links.some((a) => a.contains(target)))) release();
  });

  const hold = (el: HTMLElement): void => {
    held = el;
    mark(el);
  };
  for (const a of links)
    a.addEventListener('click', () => {
      const el = document.getElementById(idOf(a));
      if (el) hold(el);
    });

  update();
  return {
    refresh: update,
    hold,
    release: () => {
      held = null;
      update();
    },
  };
}
