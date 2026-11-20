// The docs' Copy buttons (src/pages/doc.tsx; build/docs/render.ts). Each code
// block's button is in the HTML but hidden: this shows it once the clipboard
// can be written, and copies that block's code. Without JS, or without the
// clipboard, the code still reads and selects as usual.
import { docsPage } from '../copy.ts';

/** How long the button says "Copied" before it goes back. */
const COPIED_MS = 2000;

export function startCopy(root: ParentNode, clipboard: Pick<Clipboard, 'writeText'>): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
    const code = button.closest('.doc-code')?.querySelector('pre code');
    if (!code) continue;
    const label = button.textContent ?? 'Copy';
    let timer: ReturnType<typeof setTimeout> | undefined;
    button.hidden = false;
    button.addEventListener('click', () => {
      clipboard.writeText(code.textContent ?? '').then(
        () => {
          button.textContent = docsPage.copied;
          clearTimeout(timer);
          timer = setTimeout(() => {
            button.textContent = label;
          }, COPIED_MS);
        },
        () => {
          button.textContent = label;
        },
      );
    });
  }
}

if (typeof document !== 'undefined' && navigator.clipboard) {
  startCopy(document, navigator.clipboard);
}
