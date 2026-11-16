// Each widget's updates/s for its header (M3c task 9b): how often its output
// on screen changed in the last second. The same code in every build:
//
// - A DOM widget: animation frames, on the page's main thread, in which the
//   widget's DOM changed. On native React commits it there; on Isoloop the
//   render bridge applies the isolate's changes there. Either way it counts
//   what the page drew, at most once a frame.
// - A canvas widget: its draws (at most one a frame, see Plot), counted in the
//   widget's own code and reported once a second in `timings`. On native that
//   is the main thread; on Isoloop the isolate's thread, whose canvas the
//   browser presents without the main thread in Chromium and Firefox (WebKit
//   presents it on the main thread: docs/investigations/engine-constraints.md
//   in the Isoloop repo).
//
// A widget whose report is late (its thread is busy, or it is restarting), or
// whose DOM didn't change, shows 0.
import { buildMetrics } from '#metrics';
import { useEffect, useState } from 'react';
import { CATEGORY } from '../sizes/categories';

/** Reports come once a second; one later than this counts as none. */
export const STALE_MS = 1_500;
const WINDOW_MS = 1_000;

const draws = new Map<string, { draws: number; at: number }>();
const resumed = new Map<string, number>();
/** The last minute of widget reports, for the comparison's fault figures (M3g decision 10). */
const reports: { slot: string; n: number; ts: number }[] = [];
const KEEP_REPORTS_MS = 60_000;
buildMetrics.timings((t) => {
  if (t.draws !== undefined) draws.set(t.slot, { draws: t.draws, at: performance.now() });
  if (t.resumedAt !== undefined) resumed.set(t.slot, t.resumedAt);
  reports.push({ slot: t.slot, n: (t.updates ?? 0) + (t.draws ?? 0), ts: t.ts });
  while ((reports[0]?.ts ?? Infinity) < t.ts - KEEP_REPORTS_MS) reports.shift();
});

/** Per DOM-widget slot: whether its DOM changed since the last frame, and the frames it did. */
interface Watch {
  dirty: boolean;
  frames: number[];
}
const watches = new Map<string, Watch>();
let ticking = false;

function tick(now: number): void {
  for (const w of watches.values()) {
    if (w.dirty) {
      w.dirty = false;
      w.frames.push(now);
    }
    while (w.frames.length > 0 && (w.frames[0] ?? 0) < now - WINDOW_MS) w.frames.shift();
  }
  requestAnimationFrame(tick);
}

/** Watches the slot's body, and the surface's shadow root inside it once there is one. */
function watch(slot: string, body: Element): Watch {
  const existing = watches.get(slot);
  if (existing) return existing;
  const w: Watch = { dirty: false, frames: [] };
  watches.set(slot, w);
  const mark = (): void => {
    w.dirty = true;
  };
  const opts = { subtree: true, childList: true, characterData: true, attributes: true };
  const observer = new MutationObserver((records) => {
    mark();
    for (const r of records)
      for (const n of r.addedNodes)
        if (n instanceof Element && n.shadowRoot) observer.observe(n.shadowRoot, opts);
  });
  observer.observe(body, opts);
  for (const el of body.querySelectorAll('*'))
    if (el.shadowRoot) observer.observe(el.shadowRoot, opts);
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(tick);
  }
  return w;
}

function outputOf(slot: string): { output: 'canvas' | 'dom'; body: Element | null } {
  const el = document.querySelector(`[data-slot="${CSS.escape(slot)}"]`);
  const widget = el?.getAttribute('data-widget');
  const category = widget
    ? Object.entries(CATEGORY).find(([name]) => name === widget)?.[1]
    : undefined;
  const output = category?.output ?? 'dom';
  return { output, body: el?.querySelector('.widget-body') ?? null };
}

/** The slot's updates in the last second, or 0 if none reached the screen; `null` before the first. */
export function updatesPerSec(slot: string): number | null {
  const { output, body } = outputOf(slot);
  if (output === 'canvas') {
    const r = draws.get(slot);
    if (!r) return null;
    return performance.now() - r.at > STALE_MS ? 0 : r.draws;
  }
  if (!body) return null;
  return watch(slot, body).frames.length;
}

export function useUpdatesPerSec(slot: string): number | null {
  const [n, setN] = useState(() => updatesPerSec(slot));
  useEffect(() => {
    const id = setInterval(() => {
      setN(updatesPerSec(slot));
    }, 250);
    return () => {
      clearInterval(id);
    };
  }, [slot]);
  return n;
}

// Hooks for the comparison (e2e/comparison.spec.ts), the same in every build.

/** The slot's elements, in the page and in any shadow root inside it (an Isoloop surface's). */
function deepAll(root: Element | ShadowRoot, selector: string): Element[] {
  const out = [...root.querySelectorAll(selector)];
  if (root instanceof Element && root.shadowRoot) out.push(...deepAll(root.shadowRoot, selector));
  for (const el of root.querySelectorAll('*'))
    if (el.shadowRoot) out.push(...deepAll(el.shadowRoot, selector));
  return out;
}

/**
 * True once the slot's widget shows data: a canvas with `data-drawn`, a table
 * or tile list with rows, the trades table with a row; a widget with none of
 * these (the filters, the alerts panel) once it has rendered.
 */
function hasData(slot: Element): boolean {
  const body = slot.querySelector('.widget-body');
  if (!body) return false;
  const canvas = deepAll(body, 'canvas');
  if (canvas.length > 0) return canvas.some((c) => c.hasAttribute('data-drawn'));
  const rows = deepAll(body, '[data-rows]');
  if (rows.length > 0) return rows.some((r) => Number(r.getAttribute('data-rows')) > 0);
  if (slot.getAttribute('data-widget') === 'trades') return deepAll(body, '[data-row]').length > 0;
  return deepAll(body, '*').some((el) => !el.shadowRoot);
}

declare global {
  interface Window {
    /** How many slots show data so far, for the comparison's start-up figure. */
    slotsWithData: () => number;
    /** The slot's last `resumedAt` (a canvas widget's first draw after a pause), epoch ms. */
    resumedAt: (slot: string) => number | null;
    /**
     * The renders and draws these slots reported (once a second, in their
     * own code) with a report time in (from, to], epoch ms.
     */
    updatesIn: (slots: readonly string[], from: number, to: number) => number;
    /**
     * The longest time between two reports of any of these slots, over the
     * reports in [from, to], epoch ms: about 1 s for a widget that kept
     * running, longer for one whose thread stalled.
     */
    longestSilence: (slots: readonly string[], from: number, to: number) => number | null;
    /** The time of the slot's first report after `after`, epoch ms, if there is one. */
    firstReport: (slot: string, after: number) => number | null;
  }
}
window.slotsWithData = () => [...document.querySelectorAll('[data-slot]')].filter(hasData).length;
window.resumedAt = (slot) => resumed.get(slot) ?? null;
window.updatesIn = (slots, from, to) =>
  reports
    .filter((r) => slots.includes(r.slot) && r.ts > from && r.ts <= to)
    .reduce((n, r) => n + r.n, 0);
window.longestSilence = (slots, from, to) => {
  let longest: number | null = null;
  for (const slot of slots) {
    const ts = reports
      .filter((r) => r.slot === slot && r.ts >= from && r.ts <= to)
      .map((r) => r.ts);
    for (let i = 1; i < ts.length; i++) {
      const gap = (ts[i] ?? 0) - (ts[i - 1] ?? 0);
      if (longest === null || gap > longest) longest = gap;
    }
  }
  return longest;
};
window.firstReport = (slot, after) =>
  reports.find((r) => r.slot === slot && r.ts > after)?.ts ?? null;
