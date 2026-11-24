import { defineConfig } from 'vite';
import { ui } from '../src/vite.ts';
import { charts } from './charts.tsx';

// The specimens page (ADR 0003, decision 2): every component and class with
// sample content. `pnpm --filter ui dev` serves it; the site's smoke test
// (plan task 8) runs expectAccessible on its build. Components that only
// render at build time (the charts) fill their markers here.
export default defineConfig({
  plugins: [
    ui({ header: { current: 'home' }, bar: true, footer: true }),
    {
      name: 'specimens',
      transformIndexHtml: (html) => html.replace('<!-- specimen:charts -->', charts),
    },
  ],
  base: './',
});
