// The home page's JSON-LD (ADR 0002, decision 8, as amended): the site's name,
// for search results, and who publishes it.
import { ORIGIN } from '../../build/crawl.ts';
import { site } from '../copy.ts';

/** The logo's served path (build/plugin.ts emits it). */
export const LOGO = '/brand/logo-400.png';

export const homeData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      name: 'Isoloop',
      url: `${ORIGIN}/`,
      publisher: { '@id': `${ORIGIN}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${ORIGIN}/#organization`,
      name: 'Isoloop',
      url: `${ORIGIN}/`,
      description: site.description,
      logo: ORIGIN + LOGO,
      sameAs: ['https://github.com/isoloop', 'https://www.npmjs.com/org/isoloop'],
    },
  ],
};
