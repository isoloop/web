import { isoloop } from '@isoloop/vite';
import { ui } from 'ui/vite';
import { defineConfig, type Plugin } from 'vite';
import { browserCheck } from '../../shared/browser-check.ts';
import { introHtml } from '../../shared/intro.ts';
import example from './example.json' with { type: 'json' };

/** The intro, from example.json: the site's examples hub draws the same text (shared/intro.ts). */
const intro: Plugin = {
  name: 'basic-intro',
  transformIndexHtml(html) {
    const marker = /<!-- example:intro[^>]*-->/;
    if (!marker.test(html)) throw new Error('index.html: the example:intro marker is missing');
    const blocks = example.embeds[0]?.intro;
    if (!blocks) throw new Error('example.json: embeds[0].intro is missing');
    return html.replace(marker, introHtml(blocks, 'rules'));
  },
};

// basic: four vanilla isolates (website plan task 4b). `ui` gives it the
// site's header, footer, tokens and theme script (ADR 0003); `isoloop` the
// worker URLs and `?isolate` imports; the browser check the plain-HTML notice.
export default defineConfig({
  plugins: [
    intro,
    browserCheck('isoloop'),
    isoloop(),
    ui({ header: { current: 'examples' }, footer: true }),
  ],
  base: './',
  worker: { format: 'es' },
});
