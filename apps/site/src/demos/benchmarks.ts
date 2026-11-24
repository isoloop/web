// /benchmarks/ (src/pages/benchmarks.tsx): its side nav marks the section the
// reader is at, as the docs' "On this page" does (src/demos/spy.ts). Without JS
// the nav is plain links.
import { startSpy } from './spy.ts';

const links = [...document.querySelectorAll<HTMLAnchorElement>('.bench-nav a[href^="#"]')];
if (links.length) {
  const spy = startSpy(links);
  addEventListener('hashchange', () => {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && links.some((a) => a.hash === location.hash)) spy.hold(el);
  });
}
