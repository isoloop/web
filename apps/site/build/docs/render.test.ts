// The conformance suite for renderMarkdown() (M4c, decision 7). It checks the
// interface, not markdown-it: any engine swapped into render.ts has to pass it
// unchanged.
import { describe, expect, it } from 'vitest';
import { highlight } from './highlight.ts';
import { DocError, MAX_DESCRIPTION, renderMarkdown, slug } from './render.ts';

const page = (body: string, lead = 'A page about one thing.'): string =>
  `# The title\n\n${lead}\n\n${body}`;

describe('renderMarkdown: title and description', () => {
  it('takes the title from the h1 and the description from the first paragraph', () => {
    const r = renderMarkdown(
      page('## More\n\nText.', 'The bus keeps records, with `retention` per topic.'),
    );
    expect(r.title).toBe('The title');
    expect(r.description).toBe('The bus keeps records, with retention per topic.');
    expect(r.html).toContain('<h1>The title</h1>');
  });

  it('joins a description wrapped over several lines', () => {
    expect(renderMarkdown(page('', 'One sentence\nover two lines.')).description).toBe(
      'One sentence over two lines.',
    );
  });

  it('fails without an h1 first', () => {
    expect(() => renderMarkdown('Text first.\n\n# Title\n')).toThrow(DocError);
    expect(() => renderMarkdown('## Not a title\n\nText.')).toThrow(/starts with its title/);
  });

  it('fails on a second h1', () => {
    expect(() => renderMarkdown(page('# Again\n'))).toThrow(/one "# " title/);
  });

  it('fails without a description', () => {
    expect(() => renderMarkdown('# Title\n\n## Straight to a section\n')).toThrow(
      /one-sentence description/,
    );
    expect(() => renderMarkdown('# Title\n')).toThrow(/one-sentence description/);
  });

  it('fails on a description of more than one sentence', () => {
    expect(() => renderMarkdown(page('', 'One sentence. Then another.'))).toThrow(
      /is one sentence/,
    );
  });

  it('fails on a description without a full stop', () => {
    expect(() => renderMarkdown(page('', 'No end mark'))).toThrow(/full stop/);
  });

  it(`fails on a description over ${MAX_DESCRIPTION} characters`, () => {
    const long = `${'word '.repeat(45)}end.`;
    expect(() => renderMarkdown(page('', long))).toThrow(/at most 200/);
    expect(() => renderMarkdown(page('', `${'a'.repeat(MAX_DESCRIPTION - 1)}.`))).not.toThrow();
  });

  it('names the file and the line in errors', () => {
    expect(() => renderMarkdown('# T\n\nTwo. Sentences.', { file: 'docs/guide/bus.md' })).toThrow(
      'docs/guide/bus.md:3',
    );
  });

  it("takes the lead's first sentence with lead: 'first-sentence', for a guide still being reshaped", () => {
    const doc = renderMarkdown(page('', 'The first one. Then `more` follows.'), {
      lead: 'first-sentence',
    });
    expect(doc.description).toBe('The first one.');
    expect(renderMarkdown(page('', 'Only one.'), { lead: 'first-sentence' }).description).toBe(
      'Only one.',
    );
  });

  it("still holds the first sentence to a full stop and ${MAX_DESCRIPTION} characters with lead: 'first-sentence'", () => {
    const long = `${'word '.repeat(45)}end. Short.`;
    expect(() => renderMarkdown(page('', long), { lead: 'first-sentence' })).toThrow(/at most 200/);
    expect(() => renderMarkdown(page('', 'No end mark'), { lead: 'first-sentence' })).toThrow(
      /full stop/,
    );
  });
});

describe('renderMarkdown: headings', () => {
  it('gives every heading below the title an id and lists it, in order', () => {
    const r = renderMarkdown(page('## When to use it\n\n### A detail\n\n## Limits\n'));
    expect(r.headings).toEqual([
      { depth: 2, text: 'When to use it', id: 'when-to-use-it' },
      { depth: 3, text: 'A detail', id: 'a-detail' },
      { depth: 2, text: 'Limits', id: 'limits' },
    ]);
    expect(r.html).toContain('<h2 id="when-to-use-it">When to use it</h2>');
  });

  it('makes ids the way GitHub does, so #anchors work on both', () => {
    expect(slug("What Isoloop can't hide")).toBe('what-isoloop-cant-hide');
    expect(slug('`kernel.inspect()` and the grant')).toBe('kernelinspect-and-the-grant');
    expect(renderMarkdown(page('## `ctx.inspector`\n')).headings[0]?.id).toBe('ctxinspector');
  });

  it('numbers repeated headings', () => {
    const ids = renderMarkdown(page('## Example\n\n## Example\n\n## Example\n')).headings.map(
      (h) => h.id,
    );
    expect(ids).toEqual(['example', 'example-1', 'example-2']);
  });
});

describe('renderMarkdown: tables', () => {
  const table = '| Name | Count |\n| :-- | --: |\n| a | 1 |\n';

  it('renders tables with a header row', () => {
    const { html } = renderMarkdown(page(table));
    expect(html).toMatch(
      /<table>[\s\S]*<thead>[\s\S]*<th[^>]*>Name<\/th>[\s\S]*<tbody>[\s\S]*<td[^>]*>1<\/td>/,
    );
  });

  it('aligns columns with classes, never inline styles (the CSP blocks them)', () => {
    const { html } = renderMarkdown(page(table));
    expect(html).not.toContain('style=');
    expect(html).toContain('<th class="align-left">Name</th>');
    expect(html).toContain('<td class="align-right">1</td>');
  });
});

describe('renderMarkdown: code', () => {
  it('hands each fence to the highlighter with its language, without the rest of the info string', () => {
    const seen: [string, string][] = [];
    renderMarkdown(page('```ts nocheck\nconst a = 1;\n```\n\n```\nplain\n```\n'), {
      highlight: (code, lang) => {
        seen.push([code, lang]);
        return null;
      },
    });
    expect(seen).toEqual([
      ['const a = 1;\n', 'ts'],
      ['plain\n', ''],
    ]);
  });

  it("puts the highlighter's HTML in the site's code block", () => {
    const { html } = renderMarkdown(page('```ts\nx\n```\n'), {
      highlight: () => '<span class="tok-x">x</span>',
    });
    expect(html).toContain(
      '<pre class="ui-code" tabindex="0"><code data-lang="ts"><span class="tok-x">x</span>',
    );
  });

  it('escapes code the highlighter leaves plain', () => {
    const { html } = renderMarkdown(page('```html\n<b>&</b>\n```\n'), { highlight: () => null });
    expect(html).toContain('&lt;b&gt;&amp;&lt;/b&gt;');
  });

  it('highlights through the site tokenizer, with classes only', () => {
    const { html } = renderMarkdown(page("```ts\nconst n = f('a');\n```\n\n```json\n{}\n```\n"), {
      highlight,
    });
    expect(html).toContain('<span class="tok-keyword">const</span>');
    expect(html).toContain(`<span class="tok-string">'a'</span>`);
    expect(html).toContain('<code data-lang="json">{}');
    expect(html).not.toContain('style=');
  });
});

describe('renderMarkdown: links', () => {
  const src = page(
    'See [the bus](./bus.md#retention), [ADR 0005](../adr/0005-bus.md).\n\n![A diagram](assets/a.png)\n',
  );

  it('collects every link and image as written, with its line', () => {
    expect(renderMarkdown(src).links).toEqual([
      { kind: 'link', href: './bus.md#retention', line: 5 },
      { kind: 'link', href: '../adr/0005-bus.md', line: 5 },
      { kind: 'image', href: 'assets/a.png', line: 7 },
    ]);
  });

  it('rewrites targets through the given function, and keeps them without one', () => {
    const r = renderMarkdown(src, { rewrite: (href, kind) => `/x/${kind}/${href}` });
    expect(r.html).toContain('href="/x/link/./bus.md#retention"');
    expect(r.html).toContain('src="/x/image/assets/a.png"');
    expect(r.links[0]?.href).toBe('./bus.md#retention');
    expect(renderMarkdown(src).html).toContain('href="./bus.md#retention"');
  });
});

describe('renderMarkdown: raw HTML', () => {
  it('escapes HTML in the source instead of passing it through', () => {
    const { html } = renderMarkdown(page('<script>alert(1)</script>\n\nText with <b>tags</b>.\n'));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
  });
});
