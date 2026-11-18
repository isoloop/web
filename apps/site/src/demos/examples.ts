// /examples/: one example per tab (steps.ts).
import { startSteps } from './steps.ts';

const root = document.querySelector<HTMLElement>('[data-steps]');
if (root) startSteps(root);
