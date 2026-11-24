/** @jsxImportSource preact */
import type { ComponentChildren, VNode } from 'preact';

/**
 * Paired bars (the site plan's decision 12): a baseline against Isoloop, one
 * pair per row, drawn as static SVG at build time. No chart library and no
 * script on the page, so `default-src 'self'` holds.
 *
 * - The baseline is grey; the Isoloop bar is the accent when it's better and
 *   `--ui-bad` when it's worse, and the delta under it says so in words, so
 *   colour is never the only signal.
 * - Names and values are real text beside the bars, read in order by a screen
 *   reader; the SVG itself is hidden from assistive tech.
 * - One scale per chart, from zero: every bar in it shares the same axis.
 */

export type ChartUnit = '%' | 'ms' | 's' | 'MB';
export type Verdict = 'better' | 'worse' | 'same';

export interface PairedBarsRow {
  /** What the row measures, e.g. "5 kHz" or "Main thread busy". Omit it on a one-row chart the title names. */
  label?: ComponentChildren;
  /** The baseline's value, in the chart's unit. */
  base: number;
  /** Isoloop's value, in the chart's unit. */
  value: number;
  /**
   * Overrides the verdict worked out from the sign, e.g. `'same'` when the
   * difference is inside the run's own spread.
   */
  verdict?: Verdict;
}

export interface PairedBarsProps {
  /** The figure's title, e.g. "Main thread busy". */
  title: ComponentChildren;
  /** The unit of every value in the chart. `%` deltas read as points; `ms` of 1000 or more as seconds. */
  unit: ChartUnit;
  /** The baseline's name, e.g. "Native + workers". */
  base: string;
  /** Isoloop's name, e.g. "Isoloop matched". */
  value: string;
  rows: PairedBarsRow[];
  /** Default true. Sets the verdicts, and the note under the title. */
  lowerIsBetter?: boolean;
  /** The line under the title. Default "Lower is better." or "Higher is better."; `null` for none. */
  note?: ComponentChildren | null;
  /** The top of the scale. Default: 100 for `%`, else the largest value in the chart. */
  max?: number;
  /** Decimal places shown. Default: 0, or 1 for seconds. */
  decimals?: number;
  /** Show the legend under the chart. Default true; a page with several charts can show one `ChartLegend` instead. */
  legend?: boolean;
  /**
   * Compact: the series names beside the bars are kept for screen readers but
   * not shown, so a small chart is two bars, their values and the delta. A
   * `ChartLegend` must then be on the page.
   */
  compact?: boolean;
}

export interface ChartLegendProps {
  base: string;
  value: string;
  /** Which of Isoloop's colours to explain. Default both. */
  verdicts?: Exclude<Verdict, 'same'>[] | undefined;
}

const VERDICT_WORDS: Record<Verdict, string> = {
  better: 'better',
  worse: 'worse',
  same: 'within the spread',
};

/** A value in its unit, as the chart prints it: "27%", "41 ms", "1.2 s", "44 MB". */
export function formatValue(n: number, unit: ChartUnit, decimals?: number): string {
  if (unit === 'ms' && Math.abs(n) >= 1000) return `${fixed(n / 1000, decimals ?? 1)} s`;
  const d = decimals ?? (unit === 's' ? 1 : 0);
  return unit === '%' ? `${fixed(n, d)}%` : `${fixed(n, d)} ${unit}`;
}

/** The difference in words: "52 points lower, better", "44 MB higher, worse", "the same". */
export function formatDelta(
  base: number,
  value: number,
  unit: ChartUnit,
  options: {
    lowerIsBetter?: boolean;
    decimals?: number | undefined;
    verdict?: Verdict | undefined;
  } = {},
): { text: string; verdict: Verdict } {
  const { lowerIsBetter = true, decimals } = options;
  const diff = value - base;
  const size = magnitude(Math.abs(diff), unit, decimals);
  const zero = Number(size.number) === 0;
  const verdict: Verdict =
    options.verdict ?? (zero ? 'same' : diff < 0 === lowerIsBetter ? 'better' : 'worse');
  if (zero) return { text: 'the same', verdict };
  const direction = diff < 0 ? 'lower' : 'higher';
  return { text: `${size.number} ${size.unit} ${direction}, ${VERDICT_WORDS[verdict]}`, verdict };
}

function magnitude(
  n: number,
  unit: ChartUnit,
  decimals?: number,
): { number: string; unit: string } {
  if (unit === '%') {
    const number = fixed(n, decimals ?? 0);
    return { number, unit: number === '1' ? 'point' : 'points' };
  }
  if (unit === 'ms' && n >= 1000) return { number: fixed(n / 1000, decimals ?? 1), unit: 's' };
  return { number: fixed(n, decimals ?? (unit === 's' ? 1 : 0)), unit };
}

function fixed(n: number, decimals: number): string {
  const s = n.toFixed(decimals);
  // No "-0" from rounding a tiny negative.
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

/** A bar's width as a share of the track, rounded so the markup is stable. */
function share(n: number, max: number): number {
  if (!(max > 0) || n <= 0) return 0;
  return Math.round(Math.min(n / max, 1) * 10000) / 100;
}

const BAR_H = 14;
const RADIUS = 4;

/** One bar: rounded at its data end, square at the baseline. */
function Bar({ pct }: { pct: number }): VNode {
  return (
    <svg class="ui-chart-svg" width={`${pct}%`} height={BAR_H} aria-hidden="true" focusable="false">
      {pct > 0 && (
        <>
          <rect width="100%" height={BAR_H} rx={pct >= 2 ? RADIUS : 0} />
          {pct >= 2 && <rect width={RADIUS} height={BAR_H} />}
        </>
      )}
    </svg>
  );
}

function Line(props: {
  series: 'base' | 'value';
  verdict?: Verdict;
  name: string;
  text: string;
  pct: number;
}): VNode {
  return (
    <div class="ui-chart-line" data-series={props.series} data-verdict={props.verdict}>
      <span class="ui-chart-name">{props.name}</span>
      <span class="ui-chart-track">
        <Bar pct={props.pct} />
        <span class="ui-chart-value">{props.text}</span>
      </span>
    </div>
  );
}

const BOTH: Exclude<Verdict, 'same'>[] = ['better', 'worse'];

/** The key to a chart's colours: grey for the baseline, Isoloop's colour when better and when worse. */
export function ChartLegend({ base, value, verdicts = BOTH }: ChartLegendProps): VNode {
  return (
    <ul class="ui-chart-legend" aria-label="How to read the charts">
      <li data-series="base">{base}</li>
      {verdicts.map((v) => (
        <li data-series="value" data-verdict={v} key={v}>
          {value}, {v}
        </li>
      ))}
    </ul>
  );
}

/** Paired bars: the baseline and Isoloop per row, with the difference in words. */
export function PairedBars({
  title,
  unit,
  base,
  value,
  rows,
  lowerIsBetter = true,
  note,
  max,
  decimals,
  legend = true,
  compact = false,
}: PairedBarsProps): VNode {
  const top = max ?? (unit === '%' ? 100 : Math.max(0, ...rows.flatMap((r) => [r.base, r.value])));
  const shown =
    note === undefined ? (lowerIsBetter ? 'Lower is better.' : 'Higher is better.') : note;
  const deltas = rows.map((r) =>
    formatDelta(r.base, r.value, unit, { lowerIsBetter, decimals, verdict: r.verdict }),
  );
  const used = (['better', 'worse'] as const).filter((v) => deltas.some((d) => d.verdict === v));
  return (
    <figure class="ui-chart" data-compact={compact ? '' : undefined}>
      <figcaption>
        <span class="ui-chart-title">{title}</span>
        {shown !== null && <span class="ui-chart-note">{shown}</span>}
      </figcaption>
      <ol class="ui-chart-rows">
        {rows.map((r, i) => (
          <li
            class="ui-chart-row"
            key={`${typeof r.label === 'string' ? r.label : ''}:${r.base}:${r.value}`}
          >
            {r.label !== undefined && <p class="ui-chart-label">{r.label}</p>}
            <Line
              series="base"
              name={base}
              text={formatValue(r.base, unit, decimals)}
              pct={share(r.base, top)}
            />
            <Line
              series="value"
              verdict={deltas[i]!.verdict}
              name={value}
              text={formatValue(r.value, unit, decimals)}
              pct={share(r.value, top)}
            />
            <p class="ui-chart-delta" data-verdict={deltas[i]!.verdict}>
              {deltas[i]!.text}
            </p>
          </li>
        ))}
      </ol>
      {legend && (
        <ChartLegend base={base} value={value} verdicts={used.length ? used : undefined} />
      )}
    </figure>
  );
}
