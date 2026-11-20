import { describe, expect, it } from 'vitest';
import { robots, sitemap } from './crawl.ts';

const live = (path: string, extra: object = {}) => ({
  links: { live: path, source: 'https://github.com/x', ...extra },
});

describe('robots', () => {
  it('lets every crawler in and points at the sitemap', () => {
    expect(robots()).toBe('User-agent: *\nAllow: /\n\nSitemap: https://isoloop.dev/sitemap.xml\n');
  });
});

describe('sitemap', () => {
  it("lists the site's pages and each deployed example, once, sorted, without the 404 or drafts", () => {
    const xml = sitemap(
      ['/', '/features/', '/404.html', '/examples/'],
      [
        live('/examples/basic/'),
        live('/examples/dashboards/plant/', {
          architecture: '/examples/dashboards/plant/architecture/',
        }),
        { ...live('/examples/soon/'), draft: true as const },
        live('/examples/basic/'),
      ],
    );
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([
      'https://isoloop.dev/',
      'https://isoloop.dev/examples/',
      'https://isoloop.dev/examples/basic/',
      'https://isoloop.dev/examples/dashboards/plant/',
      'https://isoloop.dev/examples/dashboards/plant/architecture/',
      'https://isoloop.dev/features/',
    ]);
    expect(xml).toMatch(
      /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/,
    );
  });

  it('escapes what XML needs escaped', () => {
    expect(sitemap(['/a&b/'], [])).toContain('<loc>https://isoloop.dev/a&amp;b/</loc>');
  });
});
