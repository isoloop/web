/** @jsxImportSource preact */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { DIAGRAM_ORDER } from './diagrams.ts';
import { loadAlternatives } from './alternatives.ts';
import { loadFeatures } from './features.ts';
import type { Doc } from './docs/pages.ts';
import { CSP, docInputs, renderDocument, site } from './plugin.ts';
import { docPage, docsIndexPage } from '../src/pages/doc.tsx';
import type { Page, SiteData } from '../src/pages/index.ts';
import { PAGES } from '../src/pages/index.ts';
import { howItWorks } from '../src/copy.ts';

function named(name: string): Page {
  const page = PAGES[name];
  if (!page) throw new Error(`no page ${name}`);
  return page;
}

const data: SiteData = {
  pin: 'f'.repeat(40),
  diagrams: [{ name: 'runtime-topology', title: 'Isoloop runtime topology' }],
  changelog: {
    packages: [{ name: '@isoloop/bus', id: 'bus', cli: false, releases: [] }],
  },
  features: loadFeatures(
    fileURLToPath(new URL('../content/features', import.meta.url)),
    { read: () => undefined, has: () => false },
    '.',
    { proofs: false },
  ),
  alternatives: loadAlternatives(
    fileURLToPath(new URL('../content/alternatives.json', import.meta.url)),
  ),
  examples: [
    {
      id: 'basic',
      title: 'Basic <b>',
      tab: 'Basic',
      summary: 'Four isolates.',
      shows: ['containment'],
      try: ['Block C.'],
      measurements: { status: 'none', note: 'Not measured.' },
      links: { live: '/examples/basic/', source: 'https://github.com/isoloop/web' },
    },
    {
      id: 'dashboards/plant',
      title: 'Plant',
      tab: 'Plant',
      summary: '72 widgets.',
      shows: ['cost'],
      try: ['Block a widget.'],
      measurements: {
        status: 'measured',
        blocks: [
          {
            id: 'desktop',
            heading: 'Desktop',
            findings: ['Main thread freed.'],
            caption: 'Chromium, 4 cores.',
            tag: 'plant-v0.1.0',
            pairs: [
              { a: 'Native', b: 'Isoloop one', label: 'Native against Isoloop one' },
              {
                a: 'Native + workers',
                b: 'Isoloop matched',
                label: 'Native + workers against matched',
              },
            ],
            groups: [
              {
                heading: 'Cost',
                rows: [
                  {
                    label: 'CPU',
                    cells: [
                      ['95%', '107%', ['+11 pts', 'worse']],
                      ['97%', '116%', ['+19 pts', 'worse']],
                    ],
                  },
                  {
                    label: 'Workers',
                    cells: [
                      ['0', '1 + bus'],
                      ['9', '10 + bus'],
                    ],
                  },
                ],
              },
            ],
            results: 'https://github.com/isoloop/web',
          },
        ],
      },
      links: { live: '/examples/dashboards/plant/', source: 'https://github.com/isoloop/web' },
    },
  ],
  samples: {
    contracts: 'c',
    durable: 'd',
    placement: 'p',
    balancer: 'b',
    agents: 'a',
    devtools: 'dt',
    grants: 'g',
    react: 'r',
    preact: 'pr',
    vanilla: 'v',
    demoTopics: 't',
    demoCounter: 'dc',
    demoMain: 'dm',
    howHost: 'hh',
    howSupervision: 'hs',
    howCatchUp: 'hc',
    howPubSub: 'hp',
    howPlacement: 'hpl',
    topics: 'tp',
    howPersistence: 'hps',
    howGrants: 'hg',
  },
  docs: [],
  docsNav: [],
  libraryVersion: '0.1.0-next.7',
};

describe('renderDocument', () => {
  const page: Page = {
    path: '/x/',
    section: 'examples',
    head: { title: 'X', description: 'D' },
    render: () => <main>hello</main>,
  };

  it('writes a whole document with the policy, head tags and ui markers', () => {
    const html = renderDocument(page, data, { csp: CSP });
    expect(html).toMatch(/^<!doctype html>\n<html lang="en">/);
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${CSP}"/>`);
    expect(html).toContain('<title>X · Isoloop</title>');
    expect(html).toContain('<link rel="canonical" href="https://isoloop.dev/x/"/>');
    expect(html).toContain('<!-- ui:header:examples -->');
    expect(html).toContain('<main>hello</main>');
    expect(html).toContain('<!-- ui:footer -->');
  });

  it('writes JSON-LD as data that no text in it can close', () => {
    const jsonLd = { name: '</script><b>"&' };
    const html = renderDocument({ ...page, jsonLd }, data, { csp: CSP });
    const block = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1] ?? '';
    expect(block).not.toContain('<');
    expect(JSON.parse(block)).toEqual(jsonLd);
  });

  it('gives a noindex page no canonical and no preview', () => {
    const html = renderDocument({ ...page, head: { ...page.head, robots: 'noindex' } }, data, {});
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:');
  });

  it('puts a search title in <title> and the preview only', () => {
    const html = renderDocument(
      { ...page, head: { ...page.head, searchTitle: 'X: more' } },
      data,
      {},
    );
    expect(html).toContain('<title>X: more · Isoloop</title>');
    expect(html).toContain('<meta property="og:title" content="X: more · Isoloop"/>');
  });

  it('leaves the policy out in dev', () => {
    expect(renderDocument(page, data, {})).not.toContain('Content-Security-Policy');
  });
});

describe('the pages', () => {
  it('render from data, escaping it', () => {
    const html = renderDocument(named('examples'), data, { csp: CSP });
    expect(html).toContain('Basic &lt;b>');
    expect(html).not.toContain('Basic <b>');
  });

  it('put the live recording on the landing page, drawn by a same-origin module script', () => {
    const html = renderDocument(named('home'), data, { csp: CSP });
    // basic's iframe is created by the script, out of view, once the recording is near.
    expect(html).toContain('data-demo="recording"');
    expect(html).toContain('<script type="module" src="/src/demos/home.ts"></script>');
    expect(html).toContain('href="/features/"');
    expect(html).toContain('href="/examples/basic/"');
    expect(html).not.toMatch(/(src|href)="http:\/\//);
    expect(html).not.toMatch(/sketch/i);
  });

  it('give /features/ nine sections, three live demos and the checked samples', () => {
    const html = renderDocument(named('features'), data, { csp: CSP });
    for (const id of [
      'containment',
      'restart',
      'bus',
      'replay',
      'durable',
      'placement',
      'frameworks',
      'safety',
      'cost',
    ])
      expect(html).toContain(`id="${id}"`);
    for (const demo of ['recording', 'bus', 'replay'])
      expect(html).toContain(`data-demo="${demo}"`);
    expect(html).toContain('<code>c</code>');
    expect(html).toContain('<script type="module" src="/src/demos/features.ts"></script>');
  });

  it('say which inline code a page needs, beside the hosting guide', () => {
    const html = renderDocument(named('features'), data, { csp: CSP });
    const from = html.indexOf('<dt>No inline scripts</dt>');
    expect(from).toBeGreaterThan(-1);
    const card = html.slice(from, html.indexOf('</dd>', from));
    expect(card).toContain("<code>style-src 'self' 'unsafe-inline'</code>");
    expect(card).toContain('href="/docs/hosting/"');
  });

  it('put every feature on one /features/ note and in one tab, the experimental ones with a pill', () => {
    const html = renderDocument(named('features'), data, { csp: CSP });
    const from = html.indexOf('<figure class="fnotes"');
    const map = html.slice(from, html.indexOf('</figure>', from));
    for (const x of data.features) {
      expect(map.split(`href="#${x.id}"`)).toHaveLength(2);
      expect(html.split(`id="${x.id}"`)).toHaveLength(2);
    }
    const experimental = data.features.filter((x) => x.experimental).length;
    expect(experimental).toBeGreaterThan(0);
    expect(map.split('class="ui-pill"')).toHaveLength(experimental + 1);
    expect(html.match(/ data-step="true"/g)).toHaveLength(6);
  });

  it('give the landing costs table in both forms, every Δ with its verdict in words', () => {
    const html = renderDocument(named('home'), data, { csp: CSP });
    expect(html).toContain('ui-delta-wide');
    expect(html).toContain('ui-delta-narrow');
    expect(html.match(/<table class="ui-table ui-delta-table">/g)).toHaveLength(3);
    const deltas = [...html.matchAll(/<td class="ui-delta"( data-verdict="(\w+)")?>(.*?)<\/td>/g)];
    expect(deltas.length).toBeGreaterThan(0);
    for (const [, , verdict, body] of deltas) {
      if (body === '') continue; // a count, with no Δ
      expect(['better', 'worse', 'same']).toContain(verdict);
      expect(body).toMatch(/class="ui-verdict">(better|worse|no change)</);
    }
  });

  it('show the pin on "how it works"', () => {
    const html = renderDocument(named('how-it-works'), data, { csp: CSP });
    expect(html).toContain('<code>fffffff</code>');
  });

  it('give /examples/ a tab per example: links, what it shows, what to try, measurements', () => {
    const html = renderDocument(named('examples'), data, { csp: CSP });
    expect(html).toContain('aria-label="Examples"');
    expect(html).toContain('href="#plant"');
    expect(html).toContain('id="plant"');
    expect(html).toContain('Block a widget.');
    expect(html).toContain('Main thread freed.');
    expect(html).toContain('Not measured.');
    expect(html.match(/<table class="ui-table ui-delta-table">/g)).toHaveLength(3);
  });

  it('refuse an example that shows a feature that doesn’t exist', () => {
    const [first, ...rest] = data.examples;
    if (!first) throw new Error('no example in the fixture');
    const bad = { ...data, examples: [{ ...first, shows: ['nope'] }, ...rest] };
    expect(() => renderDocument(named('examples'), bad, { csp: CSP })).toThrow(
      /shows "nope", which isn't a feature/,
    );
  });

  it('walk "how it works" step by step, framing every diagram once', () => {
    const all = { ...data, diagrams: DIAGRAM_ORDER.map((name) => ({ name, title: name })) };
    const html = renderDocument(named('how-it-works'), all, { csp: CSP });
    for (const name of DIAGRAM_ORDER) {
      expect(html.split(`src="/how-it-works/diagrams/${name}.html?embed=1"`)).toHaveLength(2);
      expect(html).toContain(`href="/how-it-works/diagrams/${name}.html?present=1"`);
    }
    for (const step of Object.values(howItWorks.sections)) {
      expect(html).toContain(step.heading);
    }
    expect(html).toContain(howItWorks.overview.heading);
    for (const name of DIAGRAM_ORDER) {
      expect(html).toContain(`${howItWorks.reading.heading}: ${name}`);
    }
    expect(html).toContain('aria-label="Steps"');
    for (const sample of ['hh', 'hs', 'hc', 'hp', 'hpl'])
      expect(html).toContain(`<code>${sample}</code>`);
  });

  it('never claim Isoloop is faster than native', () => {
    for (const p of Object.values(PAGES)) {
      expect(renderDocument(p, data, {}).toLowerCase()).not.toMatch(/faster than native/);
    }
  });
});

/** A plugin hook called as Vite would, with one id. */
const call = (hook: unknown, id: string): unknown =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the plugin's own hooks, called as Vite would
  (hook as (id: string) => unknown)(id);

/** A docs page as a sidebar entry. */
const item = (d: Doc) => ({
  title: d.title,
  path: d.path,
  description: d.description,
  experimental: d.experimental,
  slug: d.slug,
});

describe('the docs pages', () => {
  const doc: Doc = {
    slug: 'pools',
    kind: 'guide',
    section: 'Build',
    experimental: false,
    path: '/docs/pools/',
    title: 'Worker pools',
    description: 'Pools share a worker.',
    html: '<h1>Worker pools</h1>\n<p>Pools share a worker.</p>\n<h2 id="when">When</h2>\n',
    leadHtml: 'Pools share <code>a</code> worker.',
    body: '<h2 id="when">When</h2>\n<p>Body.</p>\n',
    headings: [
      { depth: 2, text: 'When', id: 'when' },
      { depth: 3, text: 'Detail', id: 'detail' },
    ],
    source: 'docs/guide/pools.md',
  };
  const balancer: Doc = {
    ...doc,
    slug: 'balancer',
    experimental: true,
    path: '/docs/balancer/',
    title: 'Balancer',
    description: 'It places isolates.',
  };
  const agents: Doc = {
    ...doc,
    slug: 'agents',
    section: 'Agents and tooling',
    path: '/docs/agents/',
    title: 'Agents',
    description: 'Tools for agents.',
  };
  const host: Doc = {
    ...doc,
    slug: 'api/host',
    kind: 'api',
    section: 'Reference',
    path: '/docs/api/host/',
    title: '@isoloop/host',
    description: 'The main thread.',
    body: '<h2 id="isoloophost"><code>@isoloop/host</code></h2>\n<h3 id="createkernel"><code>createKernel</code></h3>\n',
    headings: [
      { depth: 2, text: '@isoloop/host', id: 'isoloophost' },
      { depth: 3, text: 'createKernel', id: 'createkernel' },
      { depth: 3, text: 'KernelConfig', id: 'kernelconfig' },
    ],
    source: 'docs/api/host.md',
  };
  const docsData: SiteData = {
    ...data,
    docs: [doc, balancer, agents, host],
    docsNav: [
      { title: 'Build', items: [item(doc), item(balancer)] },
      { title: 'Agents and tooling', items: [item(agents)] },
      {
        title: 'Reference',
        items: [
          item(host),
          {
            title: 'Kernel config',
            path: '/docs/api/host/#kernelconfig',
            description: 'Every option.',
            experimental: false,
          },
        ],
      },
    ],
    pin: 'abcdef1234567',
  };

  it('name one virtual input per guide, under the site folder', () => {
    expect(docInputs('/s', [doc])).toEqual({ 'docs/pools': '/s/docs/pools/index.html' });
  });

  it('resolve and load each virtual input as a doc stub, and leave other files alone', () => {
    const p = site({ pages: {}, data, diagramsDir: '/nowhere', pagesModule: '', docs: [doc] });
    expect(call(p.resolveId, '/s/docs/pools/index.html')).toBe('/s/docs/pools/index.html');
    expect(call(p.load, '/s/docs/pools/index.html')).toBe('<!-- doc:pools -->\n');
    expect(call(p.resolveId, '/s/docs/bus/index.html')).toBeUndefined();
    expect(call(p.load, '/s/index.html')).toBeUndefined();
  });

  it('render a guide in the docs layout, with its title, description and canonical path', () => {
    const html = renderDocument(docPage(doc), docsData, { csp: CSP });
    expect(html).toContain('<title>Worker pools · Isoloop</title>');
    expect(html).toContain('<meta name="description" content="Pools share a worker."/>');
    expect(html).toContain('<link rel="canonical" href="https://isoloop.dev/docs/pools/"/>');
    // "Docs" is the header's section (ADR 0006).
    expect(html).toContain('<!-- ui:header:docs -->');
    expect(html).toContain('<p class="docs-lead">Pools share <code>a</code> worker.</p>');
    expect(html).toContain('<p>Body.</p>');
    // No source, Markdown or version row: the version is the header's pill (ADR 0005, amended 2026-11-20).
    expect(html).not.toContain('docs-meta');
    expect(html).not.toContain('<a href="/docs/pools.md">');
    expect(html).toContain('<script type="module" src="/src/demos/docs.ts"></script>');
  });

  it('mark the current page in the sidebar, group the sidebar by section, and mark the experimental guides', () => {
    const html = renderDocument(docPage(doc), docsData, { csp: CSP });
    expect(html).toContain('<a href="/docs/pools/" aria-current="page">Worker pools</a>');
    // In the sidebar an experimental guide gets the round mark, not the pill (ADR 0005, amended).
    // The mark stays on the title's last word, so a wrapped title ends in it.
    expect(html).toContain(
      '<a href="/docs/balancer/"><span class="docs-side-last">Balancer<span class="ui-experimental-mark" title="Experimental">',
    );
    expect(html).not.toContain('<a href="/docs/balancer/">Balancer<span class="ui-pill">');
    expect(html).toContain('<h2>Agents and tooling</h2>');
  });

  it('list only the h2s under "On this page", and link the previous and next guides', () => {
    const html = renderDocument(docPage(balancer), docsData, { csp: CSP });
    expect(html).toContain('<a href="#when">When</a>');
    expect(html).not.toContain('<a href="#detail">');
    expect(html).toContain('<a href="/docs/pools/" rel="prev">');
    expect(html).toContain('<a href="/docs/agents/" rel="next" class="next">');
  });

  it('list an API page\'s exports under its entry point in "On this page"', () => {
    const html = renderDocument(docPage(host), docsData, { csp: CSP });
    expect(html).toContain(
      '<a href="#isoloophost">@isoloop/host</a><ul><li><a href="#createkernel">createKernel</a></li><li><a href="#kernelconfig">KernelConfig</a></li></ul>',
    );
  });

  it('show a link into a page (Kernel config) in the sidebar and on /docs/, never as the current page', () => {
    const page = renderDocument(docPage(host), docsData, { csp: CSP });
    expect(page).toContain('<a href="/docs/api/host/" aria-current="page">@isoloop/host</a>');
    expect(page).toContain('<a href="/docs/api/host/#kernelconfig">Kernel config</a>');
    const index = renderDocument(docsIndexPage, docsData, { csp: CSP });
    expect(index).toContain('<b>Kernel config</b>');
    expect(index).toContain('Every option.');
  });

  it('list every section and guide on /docs/, with their descriptions', () => {
    const html = renderDocument(docsIndexPage, docsData, { csp: CSP });
    expect(html).toContain('<!-- ui:header:docs -->');
    expect(html).toContain('<h2 id="agents-and-tooling">Agents and tooling</h2>');
    expect(html).toContain('<a href="/docs/agents/"><b>Agents</b></a> Tools for agents.');
  });
});
