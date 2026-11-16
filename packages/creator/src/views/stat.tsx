import { formatValue } from '../draw/ctx';
import type { ScalarOutput, SeriesOutput } from '../outputs';
import type { ViewProps } from './props';
import { lastPoint } from './shape';
import { SIZE } from './size';

/** Where the gauge's needle points: 0 at `min`, 1 at `max`, clamped. */
export function gaugeFraction(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/** A scalar's value, or a series' newest one, with its label and unit. */
export function statOf(output: ScalarOutput | SeriesOutput): {
  value: number | null;
  label: string;
  unit: string | undefined;
} {
  const value = output.kind === 'scalar' ? output.value : (lastPoint(output)?.v ?? null);
  return { value, label: output.label, unit: output.unit };
}

/** The arc from the left end of the gauge to `f` (0–1) of the way round. */
function arc(f: number, r: number): string {
  const a = Math.PI * (1 - f);
  const x = 50 + r * Math.cos(a);
  const y = 50 - r * Math.sin(a);
  return `M ${50 - r} 50 A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

function Gauge({ value, min, max }: { value: number | null; min: number; max: number }) {
  const f = value === null ? 0 : gaugeFraction(value, min, max);
  return (
    <svg
      viewBox="0 0 100 56"
      className="creator-gauge"
      role="img"
      aria-label={`gauge from ${min} to ${max}`}
    >
      <path d={arc(1, 40)} fill="none" stroke="#444" strokeWidth="8" />
      {value !== null && f > 0 ? (
        <path
          d={arc(f, 40)}
          fill="none"
          stroke="#4e79a7"
          strokeWidth="8"
          data-fraction={f.toFixed(3)}
        />
      ) : null}
      <text x="10" y="55" fontSize="7" fill="#888">
        {formatValue(min)}
      </text>
      <text x="90" y="55" fontSize="7" fill="#888" textAnchor="end">
        {formatValue(max)}
      </text>
    </svg>
  );
}

/** One number, with its unit and label, and an optional gauge. */
export function StatView({
  output,
  title,
  size,
  gauge,
}: ViewProps<ScalarOutput | SeriesOutput> & { gauge?: { min: number; max: number } | undefined }) {
  const stat = output ? statOf(output) : { value: null, label: '', unit: undefined };
  const { value, unit } = stat;
  return (
    <div
      className="creator-view creator-view-stat"
      data-view="stat"
      data-size={size}
      data-value={value ?? undefined}
      style={{ height: SIZE[size].height }}
    >
      <div className="creator-view-title">{title}</div>
      <div className="creator-stat-value">
        {value === null ? '–' : formatValue(value)}
        {unit && value !== null ? <span className="creator-stat-unit"> {unit}</span> : null}
      </div>
      {gauge ? <Gauge value={value} min={gauge.min} max={gauge.max} /> : null}
      {stat.label ? <div className="creator-stat-label">{stat.label}</div> : null}
    </div>
  );
}
