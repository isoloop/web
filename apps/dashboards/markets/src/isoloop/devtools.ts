// `?devtools=1` (M4b task 11): the devtools panel from `@isoloop/devtools`
// (ADR 0020), a visual isolate in its own worker reading the kernel's
// inspection feed. Opened in the corner with its button or Alt+Shift+D.
//
// It loads only when asked for. The package is imported lazily, so a page
// without the flag runs no panel isolate, no extra worker and no feed reader,
// and the measured comparison runs (which never pass it) are unchanged.
import { kernel } from './kernel';

if (new URLSearchParams(location.search).get('devtools') === '1') {
  void import('@isoloop/devtools').then(({ connectDevtools }) => connectDevtools(kernel));
}
