// The docs' fences through the site's own build-time tokenizer (M4c,
// decision 8): the function renderMarkdown() is given as `highlight`. A fence
// in a language the tokenizer doesn't know comes out plain.
import { tokenize, type Lang } from '../../src/pages/code.tsx';

/** Fence names, as guides write them, to the tokenizer's languages. */
const LANGS: Record<string, Lang> = {
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
  js: 'ts',
  javascript: 'ts',
  jsx: 'tsx',
  json: 'json',
  html: 'html',
  sh: 'sh',
  bash: 'sh',
  shell: 'sh',
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A fence's code as escaped HTML with `tok-*` spans, or `null` for a language the tokenizer doesn't know. */
export function highlight(code: string, lang: string): string | null {
  const l = LANGS[lang];
  if (!l) return null;
  return tokenize(code, l)
    .map(([kind, text]) =>
      kind ? `<span class="tok-${kind}">${escapeHtml(text)}</span>` : escapeHtml(text),
    )
    .join('');
}
