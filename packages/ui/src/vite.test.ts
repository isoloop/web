import { describe, expect, it } from 'vitest';
import {
  assetPrefix,
  pageCurrent,
  placeMeta,
  placePartials,
  uiAssets,
  uiPartials,
} from './vite.ts';

describe('placeMeta', () => {
  it('gives a page its title and search tags, escaped', () => {
    const html = placeMeta('<html><head></head><body></body></html>', {
      title: 'A & "B"',
      description: 'D',
      path: '/a/',
    });
    expect(html).toContain('<link rel="canonical" href="https://isoloop.dev/a/"/>');
    expect(html).toContain('content="A &amp; &quot;B&quot;"');
  });

  it('fails on a page with a title of its own, or no <head>', () => {
    const meta = { title: 'T', robots: 'noindex' };
    expect(() => placeMeta('<head><title>x</title></head>', meta)).toThrow(/<title>/);
    expect(() => placeMeta('<body></body>', meta)).toThrow(/<head>/);
  });
});

describe('uiAssets', () => {
  it('gives full-header pages the tokens, base, shell and theme.js', () => {
    const { css, theme } = uiAssets({ header: true });
    expect(css.source).toContain('--ui-bg');
    expect(css.source).toContain('body {');
    expect(css.source).toContain('.ui-header');
    expect(css.fileName).toMatch(/^assets\/ui-[0-9a-f]{8}\.css$/);
    expect(theme?.fileName).toMatch(/^assets\/ui-theme-[0-9a-f]{8}\.js$/);
  });

  it('gives bar-only pages no element rules and no theme.js', () => {
    const { css, theme } = uiAssets({ bar: true });
    expect(css.source).toContain('.ui-bar');
    expect(css.source).not.toMatch(/^\s*body \{/m);
    expect(theme).toBeUndefined();
  });

  it('self-hosts Archivo on full-header pages: one woff2, its @font-face first in the CSS', () => {
    const { css, font } = uiAssets({ header: true });
    expect(font?.fileName).toMatch(/^assets\/archivo-[0-9a-f]{8}\.woff2$/);
    expect(font?.source).toBeInstanceOf(Uint8Array);
    const name = font?.fileName.slice('assets/'.length) ?? '';
    expect(typeof css.source === 'string' && css.source.startsWith('@font-face')).toBe(true);
    expect(css.source).toContain(`url('${name}')`);
    expect(css.source).not.toContain('data:');
  });

  it('loads no font on bar-only pages: the dashboards keep the system font', () => {
    expect(uiAssets({ bar: true }).font).toBeUndefined();
  });

  it('carries the brand: favicons on every page, the light and dark mark on full-header pages', () => {
    const full = uiAssets({ header: true });
    expect(full.brand.favicon?.fileName).toMatch(/^assets\/favicon-[0-9a-f]{8}\.svg$/);
    expect(full.brand.faviconPng?.fileName).toMatch(/^assets\/favicon-32-[0-9a-f]{8}\.png$/);
    expect(full.brand.mark?.light.fileName).toMatch(/^assets\/mark-[0-9a-f]{8}\.svg$/);
    expect(full.brand.mark?.dark.fileName).toMatch(/^assets\/mark-dark-[0-9a-f]{8}\.svg$/);
    const bar = uiAssets({ bar: true });
    expect(bar.brand.favicon).toBeDefined();
    expect(bar.brand.mark).toBeUndefined();
  });

  it('puts the mark and "isoloop" in the header', () => {
    const { header } = uiPartials({ header: true }, undefined, { light: '/l.svg', dark: '/d.svg' });
    expect(header).toContain('src="/l.svg"');
    expect(header).toContain('src="/d.svg"');
    expect(header).toContain('isoloop</a>');
  });

  it('names files by content', () => {
    expect(uiAssets({ bar: true }).css.fileName).not.toBe(uiAssets({ header: true }).css.fileName);
  });
});

describe('uiPartials', () => {
  it('marks the current section', () => {
    const { header } = uiPartials({ header: { current: 'examples' } });
    expect(header).toContain('<a href="/examples/" aria-current="page">Examples</a>');
    expect(header).toContain('<a href="/features/">Features</a>');
    expect(header).toContain('data-ui-theme-toggle');
    expect(header).toContain('role="switch"');
  });

  it('keeps GitHub out of the site nav, beside the theme switch', () => {
    const header = uiPartials({ header: {} }).header ?? '';
    const nav = header.slice(header.indexOf('<nav'), header.indexOf('</nav>'));
    expect(nav).not.toContain('github.com');
    const end = header.slice(header.indexOf('class="ui-header-end"'));
    expect(end).toContain(
      'href="https://github.com/isoloop/isoloop" aria-label="Isoloop on GitHub"',
    );
    expect(end).toContain('data-ui-theme-toggle');
  });

  it('fixes the bar dark, with no toggle', () => {
    const { bar } = uiPartials({ bar: true });
    expect(bar).toContain('data-theme="dark"');
    expect(bar).not.toContain('data-ui-theme-toggle');
  });

  it("lets a page's marker pick the section", () => {
    const { header } = uiPartials({ header: { current: 'home' } }, 'how-it-works');
    expect(header).toContain('<a href="/how-it-works/" aria-current="page">How it works</a>');
    expect(header).not.toContain('<a href="/" aria-current');
  });

  it('has Docs right after Home (ADR 0005, amended 2026-11-20)', () => {
    const { header } = uiPartials({ header: true }, 'docs');
    expect(header).toContain('<a href="/docs/" aria-current="page">Docs</a>');
    const nav = /<nav class="ui-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(header ?? '')?.[1] ?? '';
    expect([...nav.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1])).toEqual([
      'Home',
      'Docs',
      'Features',
      'How it works',
      'Examples',
    ]);
  });

  it('shows the version as a pill before GitHub, linking to the changelog', () => {
    const { header } = uiPartials({
      header: { version: { label: '0.1.0-next.8', href: '/changelog/' } },
    });
    const end = /<div class="ui-header-end">([\s\S]*)<\/div>/.exec(header ?? '')?.[1] ?? '';
    expect(end).toMatch(
      /^<a class="ui-version" href="\/changelog\/"[^>]*>0\.1\.0-next\.8<\/a><a class="ui-github"/,
    );
    expect(uiPartials({ header: true }).header).not.toContain('ui-version');
  });

  it('renders only what was asked for', () => {
    expect(uiPartials({ footer: true })).toMatchObject({ header: null, bar: null });
  });
});

describe('placePartials', () => {
  const page = '<html><body class="x"><main>m</main></body></html>';

  it('puts the header first in <body> and the footer last', () => {
    expect(placePartials(page, { header: '<header/>', bar: null, footer: '<footer/>' })).toBe(
      '<html><body class="x"><header/><main>m</main><footer/></body></html>',
    );
  });

  it('uses a marker comment when there is one, and drops unused markers', () => {
    const marked = '<body><div><!-- ui:header --></div><!-- ui:bar --></body>';
    expect(placePartials(marked, { header: '<header/>', bar: null, footer: null })).toBe(
      '<body><div><header/></div></body>',
    );
  });
});

describe('assetPrefix', () => {
  it('climbs from nested pages under a relative base', () => {
    expect(assetPrefix('./', '/index.html')).toBe('./');
    expect(assetPrefix('./', '/how-it-works/index.html')).toBe('../');
    expect(assetPrefix('', '/a/b/index.html')).toBe('../../');
  });

  it('uses an absolute base as it is', () => {
    expect(assetPrefix('/', '/how-it-works/index.html')).toBe('/');
    expect(assetPrefix('/examples/basic', '/index.html')).toBe('/examples/basic/');
  });
});

describe('pageCurrent', () => {
  it('reads the section from the header marker and leaves a plain marker', () => {
    expect(pageCurrent('<body><!-- ui:header:examples --></body>')).toEqual({
      html: '<body><!-- ui:header --></body>',
      current: 'examples',
    });
  });

  it('leaves a page without one alone', () => {
    expect(pageCurrent('<body></body>')).toEqual({ html: '<body></body>', current: undefined });
  });

  it('refuses an unknown section', () => {
    expect(() => pageCurrent('<!-- ui:header:blog -->')).toThrow(/unknown header section/);
  });
});
