/** @jsxImportSource preact */
import type { VNode } from 'preact';

/**
 * Inline Markdown as changelogs write it: `code`, [links](https://…) and
 * **bold**. Anything else stays text; Preact escapes it.
 */
export function inline(text: string): (string | VNode)[] {
  const out: (string | VNode)[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const key = String(n++);
    if (m[1] !== undefined) out.push(<code key={key}>{m[1]}</code>);
    else if (m[2] !== undefined && m[3] !== undefined)
      out.push(
        <a key={key} href={m[3]}>
          {inline(m[2])}
        </a>,
      );
    else if (m[4] !== undefined) out.push(<b key={key}>{m[4]}</b>);
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
