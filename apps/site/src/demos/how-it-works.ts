// /how-it-works/: the step tabs (steps.ts), the code tabs, and each diagram's frame sized to its drawing.
import { startSteps } from './steps.ts';
import { startTabs } from './tabs.ts';

for (const t of document.querySelectorAll<HTMLElement>('[data-tabs]')) startTabs(t);

// Each framed diagram takes its drawing's proportions, so all of it shows
// (the embedded viewer fits the drawing to the frame's width). Without JS
// the frame keeps its fixed height.
for (const d of document.querySelectorAll<HTMLElement>('.hiw-diagram[data-ratio]')) {
  const r = Number(d.dataset['ratio']);
  if (r > 0) {
    // A little taller than the drawing, for the viewer's padding.
    d.style.setProperty('--ratio', String(r * 0.97));
    d.classList.add('fit');
  }
}

const root = document.querySelector<HTMLElement>('[data-steps]');
if (root) startSteps(root);
