/** @jsxImportSource preact */
// The charts' specimen: the component rendered at build time into the page's
// `<!-- specimen:charts -->` marker, so the site's axe check sees it in both
// themes. A full chart, then two compact ones sharing one legend.
import { ChartLegend, PairedBars } from '../src/components/index.ts';
import { render } from '../src/render.ts';

const base = 'Native + workers';
const value = 'Isoloop matched';

export const charts = render(
  <>
    <PairedBars
      title="Main thread busy"
      unit="%"
      base={base}
      value={value}
      rows={[
        { label: '1 kHz', base: 41, value: 15 },
        { label: '5 kHz', base: 79, value: 27 },
      ]}
    />
    <PairedBars
      compact
      legend={false}
      title="Typing, median"
      unit="ms"
      base={base}
      value={value}
      rows={[{ base: 62, value: 41 }]}
    />
    <PairedBars
      compact
      legend={false}
      title="Memory after GC"
      unit="MB"
      base={base}
      value={value}
      rows={[{ base: 104, value: 150 }]}
    />
    <ChartLegend base={base} value={value} />
  </>,
);
