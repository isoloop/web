import type { Page } from '@playwright/test';
import { MACHINES } from '../src/core/machines';

/**
 * Waits until each machine's `widget` has `css` on show, with `attr` matching
 * `pattern` if given, in one query every 500 ms.
 *
 * Not a locator per machine: on Firefox, eight of them waiting at once starve
 * the page of its workers' messages, so beats and `ready` don't arrive and the
 * supervisor kills healthy workers (isoloop/web#266).
 */
export async function everyMachineShows(
  page: Page,
  want: { widget: string; css: string; attr?: string; pattern?: RegExp },
  timeout: number,
): Promise<void> {
  await page.waitForFunction(
    ({ machines, widget, css, attr, source }) =>
      machines.every((m) => {
        const slot = document.querySelector(`[data-slot="${m}-${widget}"]`);
        // On the Isoloop build it's in the surface's shadow root.
        const el =
          slot?.querySelector(css) ??
          slot?.querySelector('iso-surface')?.shadowRoot?.querySelector(css);
        if (!el || el.getBoundingClientRect().width === 0) return false;
        if (!attr) return true;
        const value = el.getAttribute(attr);
        return value !== null && new RegExp(source).test(value);
      }),
    {
      machines: [...MACHINES],
      widget: want.widget,
      css: want.css,
      attr: want.attr ?? '',
      source: want.pattern?.source ?? '',
    },
    { timeout, polling: 500 },
  );
}
