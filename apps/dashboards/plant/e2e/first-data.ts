import type { Page } from '@playwright/test';
import { MACHINES } from '../src/core/machines';

/**
 * Waits until each machine's `widget` has `css` on show, with `attr` holding a
 * digit if one is given, in one query every 500 ms.
 *
 * Not a locator per machine: on Firefox, eight of them waiting at once starve
 * the page of its workers' messages, so beats and `ready` don't arrive and the
 * supervisor kills healthy workers (isoloop/web#266).
 */
export async function everyMachineShows(
  page: Page,
  want: { widget: string; css: string; attr?: string },
  timeout: number,
): Promise<void> {
  await page.waitForFunction(
    ({ machines, widget, css, attr }) =>
      machines.every((m) => {
        const slot = document.querySelector(`[data-slot="${m}-${widget}"]`);
        // On the Isoloop build it's in the surface's shadow root.
        const el =
          slot?.querySelector(css) ??
          slot?.querySelector('iso-surface')?.shadowRoot?.querySelector(css);
        if (!el || el.getBoundingClientRect().width === 0) return false;
        return attr === undefined || /\d/.test(el.getAttribute(attr) ?? '');
      }),
    { machines: [...MACHINES], ...want },
    { timeout, polling: 500 },
  );
}
