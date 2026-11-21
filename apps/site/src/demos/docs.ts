// A docs page (src/pages/doc.tsx): the code blocks' Copy button, and "On this
// page" marking the heading the reader is at (src/demos/spy.ts). Without JS
// the contents are plain links.
import './copy.ts';
import { startSpy } from './spy.ts';

const links = [...document.querySelectorAll<HTMLAnchorElement>('.docs-toc a[href^="#"]')];
if (links.length) {
  const spy = startSpy(links);
  addEventListener('hashchange', () => {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el && links.some((a) => a.hash === location.hash)) spy.hold(el);
  });
}
