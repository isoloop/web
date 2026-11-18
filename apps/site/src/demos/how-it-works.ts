// /how-it-works/: the code tabs (no live demo on this page).
import { startTabs } from './tabs.ts';

for (const t of document.querySelectorAll<HTMLElement>('[data-tabs]')) startTabs(t);
