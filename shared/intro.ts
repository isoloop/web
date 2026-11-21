// An example page's intro, written once in the app's example.json
// (`embeds[].intro`) and drawn both on the page itself and on the site's
// examples hub, so the two can't drift. A block is a paragraph, or a list.
// Text marks `code` and **bold**, nothing else; the hub's renderer
// (apps/site/src/pages/inline.tsx) reads the same marks.

export type IntroBlock = string | { list: string[] };

export interface Span {
  kind: 'text' | 'code' | 'bold';
  text: string;
}

/** A line's text, split into plain, `code` and **bold** runs. */
export function spans(text: string): Span[] {
  const out: Span[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push({ kind: 'text', text: text.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'code', text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: 'bold', text: m[2] });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
  return out;
}

const escape = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** A line as HTML, escaped. */
export function lineHtml(text: string): string {
  return spans(text)
    .map((s) =>
      s.kind === 'code'
        ? `<code>${escape(s.text)}</code>`
        : s.kind === 'bold'
          ? `<strong>${escape(s.text)}</strong>`
          : escape(s.text),
    )
    .join('');
}

/** The intro as HTML, for a static page; `listClass` names its lists. */
export function introHtml(blocks: IntroBlock[], listClass = ''): string {
  const cls = listClass ? ` class="${escape(listClass)}"` : '';
  return blocks
    .map((b) =>
      typeof b === 'string'
        ? `<p>${lineHtml(b)}</p>`
        : `<ul${cls}>${b.list.map((li) => `<li>${lineHtml(li)}</li>`).join('')}</ul>`,
    )
    .join('\n');
}
