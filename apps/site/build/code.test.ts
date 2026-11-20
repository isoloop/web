import { describe, expect, it } from 'vitest';
import { langOf, tokenize, type Lang, type Token } from '../src/pages/code.tsx';

const kinds = (tokens: Token[]): [string, string][] =>
  tokens.filter((t): t is [string, string] => t[0] !== null).map(([k, t]) => [k, t]);

describe('tokenize', () => {
  it('gives back the source unchanged, token by token', () => {
    const src = "import { count } from './topics';\n// a note\nconst n = useTopic(count) ?? 0;";
    expect(
      tokenize(src, 'ts')
        .map((t) => t[1])
        .join(''),
    ).toBe(src);
  });

  it('marks keywords, strings, comments, numbers and called functions', () => {
    expect(kinds(tokenize("const n = f('a', 100); // done", 'ts'))).toEqual([
      ['keyword', 'const'],
      ['fn', 'f'],
      ['string', "'a'"],
      ['number', '100'],
      ['comment', '// done'],
    ]);
  });

  it('marks JSX tag names, not the words between tags', () => {
    expect(kinds(tokenize('<button onClick={go}>Count</button>', 'ts'))).toEqual([
      ['tag', 'button'],
      ['tag', 'button'],
    ]);
  });

  it('keeps a keyword inside a string or a comment as part of it', () => {
    expect(kinds(tokenize("'import' /* const */", 'ts'))).toEqual([
      ['string', "'import'"],
      ['comment', '/* const */'],
    ]);
  });

  it('marks shell comments and the command on each line', () => {
    expect(kinds(tokenize('pnpm add x@next\n# for React:\npnpm add y', 'sh'))).toEqual([
      ['fn', 'pnpm'],
      ['comment', '# for React:'],
      ['fn', 'pnpm'],
    ]);
  });
});

describe('tokenize: tsx, json and html', () => {
  const samples: [Lang, string][] = [
    ['tsx', 'export const C = () => <div class="a">{n}</div>; // ok'],
    ['json', '{ "name": "site", "n": -1.5e3, "ok": true, "x": null }'],
    ['html', '<!doctype html>\n<!-- a note -->\n<p class="x" id=\'y\'>Text "quoted"</p>'],
  ];

  it.each(samples)('gives back %s source unchanged, token by token', (lang, src) => {
    expect(
      tokenize(src, lang)
        .map((t) => t[1])
        .join(''),
    ).toBe(src);
  });

  it('marks tsx exactly as ts', () => {
    const src = 'const el = <Counter step={2} />;\nrender(el);';
    expect(tokenize(src, 'tsx')).toEqual(tokenize(src, 'ts'));
  });

  it('marks json strings, numbers and literals', () => {
    expect(kinds(tokenize('{ "n": -1.5e3, "ok": true, "x": null, "s": "a:b" }', 'json'))).toEqual([
      ['string', '"n"'],
      ['number', '-1.5e3'],
      ['string', '"ok"'],
      ['keyword', 'true'],
      ['string', '"x"'],
      ['keyword', 'null'],
      ['string', '"s"'],
      ['string', '"a:b"'],
    ]);
  });

  it('keeps a number inside a json string as part of it', () => {
    expect(kinds(tokenize('{"v": "1.2"}', 'json'))).toEqual([
      ['string', '"v"'],
      ['string', '"1.2"'],
    ]);
  });

  it('marks html comments, the doctype, tag names and attribute values, not quoted text', () => {
    expect(kinds(tokenize(samples[2]![1], 'html'))).toEqual([
      ['keyword', '<!doctype html>'],
      ['comment', '<!-- a note -->'],
      ['tag', 'p'],
      ['string', '"x"'],
      ['string', "'y'"],
      ['tag', 'p'],
    ]);
  });
});

describe('langOf', () => {
  it('takes the language from the file name', () => {
    expect(langOf('main.ts')).toBe('ts');
    expect(langOf('counter.tsx')).toBe('tsx');
    expect(langOf('counter.jsx')).toBe('tsx');
    expect(langOf('example.json')).toBe('json');
    expect(langOf('index.html')).toBe('html');
    expect(langOf('install.sh')).toBe('sh');
    expect(langOf('main.js')).toBe('ts');
  });
});
