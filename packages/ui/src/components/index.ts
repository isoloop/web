// The shared components (ADR 0003, decision 2): Preact, rendered to static
// HTML at build time through render(); no component code reaches a page.
export { Bar } from './Bar.tsx';
export { Button, type ButtonProps } from './Button.tsx';
export { Callout } from './Callout.tsx';
export { Card, type CardProps } from './Card.tsx';
export { ExperimentalMark } from './ExperimentalMark.tsx';
export { Footer } from './Footer.tsx';
export { Frame, type FrameProps } from './Frame.tsx';
export { Head, type HeadProps } from './Head.tsx';
export { Header, type Current } from './Header.tsx';
export { PageMeta, type PageMetaProps } from './PageMeta.tsx';
export {
  ChartLegend,
  formatDelta,
  formatValue,
  opsNumber,
  PairedBars,
  type ChartLegendProps,
  type ChartUnit,
  type PairedBarsProps,
  type PairedBarsRow,
  type Verdict,
} from './PairedBars.tsx';
export { Table, type TableProps } from './Table.tsx';
export { ThemeToggle } from './ThemeToggle.tsx';
