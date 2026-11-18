/** @jsxImportSource preact */
import type { VNode } from 'preact';

/**
 * Syntax highlighting at build time: the code comes out as spans with a token
 * class, so the browser runs nothing (the site's policy) and no highlighter
 * ships. Small on purpose: comments, strings, keywords, numbers, JSX tags and
 * called functions for TypeScript; comments and commands for shell.
 */
export type Lang = 'ts' | 'sh';

export type Token = [kind: string | null, text: string];

const KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'declare',
  'default',
  'else',
  'export',
  'extends',
  'false',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'return',
  'satisfies',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'void',
  'while',
]);

const TS = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
    String.raw`(?<string>'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|` + '`(?:\\\\.|[^`\\\\])*`)',
    String.raw`(?<tag>(?<=<\/?)[A-Za-z][\w.]*)`,
    String.raw`(?<number>\b\d[\d_]*(?:\.\d+)?\b)`,
    String.raw`(?<word>[A-Za-z_$][\w$]*)`,
  ].join('|'),
  'g',
);

const SH = /(?<comment>#[^\n]*)|(?<command>^[ \t]*[\w.-]+)/gm;

/** Splits code into tokens; text between matches comes back unclassed. */
export function tokenize(code: string, lang: Lang): Token[] {
  const re = lang === 'sh' ? SH : TS;
  re.lastIndex = 0;
  const out: Token[] = [];
  let at = 0;
  for (const m of code.matchAll(re)) {
    const g = m.groups ?? {};
    const text = m[0];
    const start = m.index;
    if (start > at) out.push([null, code.slice(at, start)]);
    at = start + text.length;
    let kind: string | null = null;
    if (g['comment'] !== undefined) kind = 'comment';
    else if (g['string'] !== undefined) kind = 'string';
    else if (g['tag'] !== undefined) kind = 'tag';
    else if (g['number'] !== undefined) kind = 'number';
    else if (g['command'] !== undefined) kind = 'fn';
    else if (g['word'] !== undefined) {
      if (KEYWORDS.has(text)) kind = 'keyword';
      else if (/^\s*\(/.test(code.slice(at))) kind = 'fn';
    }
    out.push([kind, text]);
  }
  if (at < code.length) out.push([null, code.slice(at)]);
  return out;
}

/** The language a file name implies. */
export function langOf(file: string): Lang {
  return /\.(sh|bash)$/.test(file) ? 'sh' : 'ts';
}

/** A block of code, highlighted, scrollable and reachable by keyboard. */
export function Code({ children, lang = 'ts' }: { children: string; lang?: Lang }): VNode {
  return (
    <pre class="ui-code" tabindex={0}>
      <code>
        {tokenize(children, lang).map(([kind, text], i) =>
          kind ? (
            // oxlint-disable-next-line react/no-array-index-key -- static, rendered once
            <span key={i} class={`tok-${kind}`}>
              {text}
            </span>
          ) : (
            text
          ),
        )}
      </code>
    </pre>
  );
}

export interface CodeTab {
  key: string;
  label: string;
  code: string;
  lang?: Lang;
}

/**
 * Code files as tabs (src/demos/tabs.ts): without JS every file shows with its
 * title, one after another; with it, a tablist shows one at a time.
 */
export function CodeTabs({
  id,
  label,
  tabs,
}: {
  /** Prefixes the tab and panel ids; none keeps them as tab-<key>, panel-<key>. */
  id?: string;
  label: string;
  tabs: CodeTab[];
}): VNode {
  const p = id ? `${id}-` : '';
  return (
    <div class="tabs" data-tabs>
      <div role="tablist" aria-label={label} hidden>
        {tabs.map((t, i) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`tab-${p}${t.key}`}
            aria-controls={`panel-${p}${t.key}`}
            aria-selected={i === 0 ? 'true' : 'false'}
            tabindex={i === 0 ? 0 : -1}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`panel-${p}${t.key}`}
          aria-labelledby={`tab-${p}${t.key}`}
        >
          <p class="tab-title">{t.label}</p>
          <Code lang={t.lang ?? 'ts'}>{t.code}</Code>
        </div>
      ))}
    </div>
  );
}
