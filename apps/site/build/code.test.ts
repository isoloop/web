import { describe, expect, it } from 'vitest';
import { langOf, tokenize, type Token } from '../src/pages/code.tsx';

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

describe('langOf', () => {
  it('takes the language from the file name', () => {
    expect(langOf('main.ts')).toBe('ts');
    expect(langOf('counter.tsx')).toBe('ts');
    expect(langOf('install.sh')).toBe('sh');
  });
});
