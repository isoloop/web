// The docs' search box (src/pages/doc.tsx, SearchBox): shown here, since
// without JS there's nothing to search with. The index (/docs/search.json,
// build/docs/search.ts) loads on first focus or keypress, not with the page;
// the matching is src/search/match.ts. ARIA combobox: the input controls a
// listbox, aria-activedescendant names the result in hand; Up and Down move,
// Enter opens, Escape closes. "/" anywhere focuses the box in view.
import { docsPage } from '../copy.ts';
import { createSearch, isEntries, type DocsSearch, type Hit, type Range } from '../search/match.ts';

const LIMIT = 8;

let engine: Promise<DocsSearch> | undefined;
const load = (): Promise<DocsSearch> =>
  (engine ??= fetch('/docs/search.json')
    .then((r) => r.json())
    .then((data: unknown) => {
      if (!isEntries(data)) throw new Error('/docs/search.json: not a search index');
      return createSearch(data);
    }));

/** `text` with `marks` wrapped in <mark>, as text nodes only (no markup from the index). */
function marked(text: string, marks: Range[]): DocumentFragment {
  const f = document.createDocumentFragment();
  let at = 0;
  for (const [a, b] of marks) {
    if (a > at) f.append(text.slice(at, a));
    const m = document.createElement('mark');
    m.textContent = text.slice(a, b);
    f.append(m);
    at = b;
  }
  if (at < text.length) f.append(text.slice(at));
  return f;
}

/** The compact experimental mark, as packages/ui's ExperimentalMark draws it. */
function experimental(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ui-experimental-mark';
  span.title = 'Experimental';
  span.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.3v4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11.4" r="1.05" fill="currentColor"/></svg><span class="ui-sr-only"> Experimental</span>';
  return span;
}

function start(box: HTMLElement): void {
  const input = box.querySelector('input');
  const panel = box.querySelector<HTMLElement>('.docs-search-panel');
  const list = box.querySelector<HTMLUListElement>('[role="listbox"]');
  const empty = box.querySelector<HTMLElement>('.docs-search-empty');
  if (!input || !panel || !list || !empty) return;
  box.hidden = false;
  let hits: Hit[] = [];
  let active = -1;

  const open = (on: boolean): void => {
    panel.hidden = !on;
    input.setAttribute('aria-expanded', String(on));
    if (!on) {
      active = -1;
      input.removeAttribute('aria-activedescendant');
    }
  };
  const mark = (i: number): void => {
    active = i;
    [...list.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    const li = list.children[i];
    if (li) {
      input.setAttribute('aria-activedescendant', li.id);
      li.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const go = (i: number): void => {
    const hit = hits[i];
    if (!hit) return;
    open(false);
    location.assign(hit.entry.u);
  };

  const render = (q: string): void => {
    list.replaceChildren();
    empty.textContent = '';
    if (!q.trim()) return open(false);
    hits.forEach((hit, i) => {
      const li = document.createElement('li');
      li.id = `${list.id}-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      const title = document.createElement('span');
      title.className = 'docs-search-title';
      title.append(marked(hit.entry.t, hit.marks.title));
      if (hit.entry.e) title.append(experimental());
      li.append(title);
      if (hit.entry.h) {
        const h = document.createElement('span');
        h.className = 'docs-search-heading';
        h.append(marked(hit.entry.h, hit.marks.heading));
        li.append(h);
      }
      const snip = document.createElement('span');
      snip.className = 'docs-search-snippet';
      snip.append(marked(hit.snippet, hit.marks.snippet));
      li.append(snip);
      // On pointer down, so the input's blur doesn't close the panel first.
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        go(i);
      });
      li.addEventListener('mousemove', () => {
        if (active !== i) mark(i);
      });
      list.append(li);
    });
    if (!hits.length) empty.textContent = `${docsPage.search.empty} “${q.trim()}”`;
    open(true);
    mark(hits.length ? 0 : -1);
  };

  const run = async (): Promise<void> => {
    const q = input.value;
    const s = await load();
    if (input.value !== q) return; // a newer keystroke runs its own
    hits = q.trim() ? s.search(q, LIMIT) : [];
    render(q);
  };

  input.addEventListener('focus', () => {
    void load();
    if (input.value.trim()) void run();
  });
  input.addEventListener('input', () => void run());
  input.addEventListener('blur', () => open(false));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && hits.length) {
      e.preventDefault();
      if (panel.hidden) void run();
      mark((active + 1) % hits.length);
    } else if (e.key === 'ArrowUp' && hits.length) {
      e.preventDefault();
      mark((active - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      if (!panel.hidden && hits.length) {
        e.preventDefault();
        go(active < 0 ? 0 : active);
      }
    } else if (e.key === 'Escape') {
      if (!panel.hidden) {
        e.preventDefault();
        open(false);
      } else if (input.value) input.value = '';
      else input.blur();
    }
  });
}

const boxes = [...document.querySelectorAll<HTMLElement>('[data-search]')];
boxes.forEach(start);

// "/" focuses the search box in view, unless the reader is typing somewhere.
addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target instanceof HTMLElement ? e.target : null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const box = boxes.find((b) => b.offsetParent !== null);
  const input = box?.querySelector('input');
  if (!input) return;
  e.preventDefault();
  input.focus();
});
