// The entry: the build's alias picks main.isoloop.tsx, main.native.tsx or
// main.native-workers.tsx. It loads only where the page's browser check passed
// (lib/shared/browser-check.ts); otherwise the page's notice names what's missing.
import '../lib/shared/guard.ts';
import '#main';
import '../lib/shared/booted.ts';
