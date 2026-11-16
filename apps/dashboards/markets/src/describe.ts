// The box under the header: what the page's three choices mean. Mode is the
// kernel switch, Library the build, Placement the Isoloop placement (its row,
// DESCRIPTION, is in placement.ts). One sentence each, two lines at most.
import type { BuildName, Side } from './builds';

export const MODE: Record<Side, string> = {
  native: 'No Isoloop: the app as a team would write it today, on the same widgets and data.',
  isoloop:
    'Each widget and data job is an isolate: its own event loop, restarted when it fails, talking over a bus that keeps its records.',
};

export const LIBRARY: Record<BuildName, string> = {
  isoloop: 'Every widget renders with React, a copy per isolate or per pool.',
  'isoloop-preact': 'Every widget renders with Preact, a copy per isolate or per pool.',
  mixed:
    'React widgets, except the filters and the alerts panel: those are Preact, built and shipped apart and loaded at run time, as isolates another team ships would be.',
  native:
    'Every widget renders with React on the main thread, beside the data pipeline. A blocked widget stalls the whole page.',
  'native-preact':
    'Every widget renders with Preact on the main thread, beside the data pipeline. A blocked widget stalls the whole page.',
  'native-workers':
    'React widgets on the main thread; the replay, the aggregator, alerts and the three engines in a hand-written worker each. A blocked widget stalls the whole page; the data keeps flowing.',
};
