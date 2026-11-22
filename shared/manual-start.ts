// `?start=manual`: the page shows its UI but starts no kernel and no worker
// until it's told to. The site's examples hub frames basic and the processor
// pages this way and draws its own Start over the frame: the page says it's
// idle, and waits for the hub's start message (same origin only). Opened on
// its own with start=manual, with no parent to start it, the page draws its
// own Start button instead. Without the parameter, `whenStarted()` resolves at
// once and the page starts as it always has.

/** Whether this page waits to be started. */
export const manualStart: boolean = (() => {
  try {
    return new URLSearchParams(location.search).get('start') === 'manual';
  } catch {
    return false;
  }
})();

/** The messages between the hub and a framed example. */
export const START = 'isoloop-example:start';
export const IDLE = 'isoloop-example:idle';

const typeOf = (data: unknown): unknown =>
  typeof data === 'object' && data !== null ? Reflect.get(data, 'type') : undefined;

const CSS = `
.manual-start {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  margin: 1rem 0;
  padding: 1rem 1.25rem;
  border: 1px dashed var(--ui-border, currentColor);
  border-radius: 0.6rem;
}
.manual-start p {
  margin: 0;
}`;

/**
 * Resolves when the page may start. With `?start=manual` in a frame: tells
 * the parent it's idle and resolves on the parent's start message. On its
 * own: draws a Start control before, after or at the end of `where` and
 * resolves on its click. Otherwise resolves at once.
 */
export function whenStarted(
  where: Element | null,
  text: string,
  place: 'before' | 'after' | 'append' = 'before',
): Promise<void> {
  if (!manualStart) return Promise.resolve();
  if (window.parent !== window) {
    return new Promise((resolve) => {
      const on = (e: MessageEvent): void => {
        if (e.origin !== location.origin || e.source !== window.parent) return;
        if (typeOf(e.data) !== START) return;
        removeEventListener('message', on);
        resolve();
      };
      addEventListener('message', on);
      window.parent.postMessage({ type: IDLE }, location.origin);
    });
  }
  if (!where) return Promise.resolve();
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const box = document.createElement('div');
  box.className = 'manual-start';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ui-button';
  button.dataset['primary'] = '';
  button.dataset['strong'] = '';
  button.textContent = 'Start';
  const note = document.createElement('p');
  note.textContent = text;
  box.append(button, note);
  if (place === 'before') where.before(box);
  else if (place === 'after') where.after(box);
  else where.append(box);
  return new Promise((resolve) => {
    button.addEventListener(
      'click',
      () => {
        box.remove();
        resolve();
      },
      { once: true },
    );
  });
}
