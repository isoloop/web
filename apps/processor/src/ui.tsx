// What both processor pages draw the same way: a worker's lag against the
// balancer's thresholds, the move log, and a model redrawn ten times a second.
import { useEffect, useState, type ReactElement } from 'react';

/** The balancer's thresholds (ADR 0017 defaults), drawn on each worker's lag. */
export const SUSTAINED_MS = 50;
export const SPIKE_MS = 100;
/** The lag chart's top. */
const CHART_MAX_MS = 150;

export const REASONS: Record<string, string> = {
  spike: 'spike',
  /** A full pool: its tasks add up to 80 % of a core. */
  full: 'too busy',
  /** A pool that lags over 50 ms for 3 s. */
  sustained: 'lagging',
  crash: 'crashed',
  bisect: 'bisect',
  steady: 'steady again',
  restart: 'restarted',
  /** Its reported backlog kept rising (M3i). */
  backlog: 'falling behind',
  /** A quiet task joining another pool to free a worker (M3i). */
  pack: 'packed',
  /** A first long task: noted, nothing moves (M3i). */
  noted: 'spike noted',
  /** Falling behind with nowhere to give it more CPU (M3i). */
  behind: 'behind',
  /** The kernel gave up on it (past its restart limit); the balancer leaves it be (M3j). */
  failed: 'given up',
};

/** A move or crash, as both pages log it. */
export type LogEntry = { at: number; text: string; kind: string; costMs?: number };

const cost = (ms: number): string =>
  ms < 1_000 ? `${Math.round(ms)} ms` : `${(ms / 1_000).toFixed(1)} s`;

/** A model's snapshot, ten times a second, and a way to redraw at once after an action. */
export function useSnapshot<S>(model: { snapshot(): S }): [S, () => void] {
  const [snap, setSnap] = useState(() => model.snapshot());
  useEffect(() => {
    const t = setInterval(() => setSnap(model.snapshot()), 100);
    return () => clearInterval(t);
  }, [model]);
  return [snap, () => setSnap(model.snapshot())];
}

export function LagChart({ lags }: { lags: number[] }): ReactElement {
  const w = 240;
  const h = 48;
  const y = (ms: number): number => h - (Math.min(ms, CHART_MAX_MS) / CHART_MAX_MS) * h;
  const step = w / 60;
  const last = lags.at(-1);
  const peak = lags.length > 0 ? Math.max(...lags) : undefined;
  return (
    <figure className="lag">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Worker lag">
        <line
          className="threshold sustained"
          x1="0"
          x2={w}
          y1={y(SUSTAINED_MS)}
          y2={y(SUSTAINED_MS)}
        />
        <line className="threshold spike" x1="0" x2={w} y1={y(SPIKE_MS)} y2={y(SPIKE_MS)} />
        {lags.map((ms, i) => (
          <rect
            key={i}
            className={ms > SPIKE_MS ? 'bar over' : ms > SUSTAINED_MS ? 'bar high' : 'bar'}
            x={w - (lags.length - i) * step}
            y={y(ms)}
            width={Math.max(1, step - 1)}
            height={h - y(ms)}
          />
        ))}
      </svg>
      <figcaption className="mono">
        lag {last === undefined ? '--' : Math.round(last)} ms · peak{' '}
        {peak === undefined ? '--' : Math.round(peak)} ms
      </figcaption>
    </figure>
  );
}

export function MoveLog({ log }: { log: LogEntry[] }): ReactElement {
  return (
    <section className="log" aria-label="Moves">
      <h2>Moves</h2>
      {log.length === 0 ? (
        <p className="muted">Nothing has moved yet.</p>
      ) : (
        <ol>
          {log.map((e, i) => (
            <li key={`${e.at}-${i}`} data-kind={e.kind}>
              <time className="mono muted">{new Date(e.at).toLocaleTimeString()}</time>
              <span className="badge" data-reason={e.kind}>
                {REASONS[e.kind] ?? e.kind}
              </span>
              <span className="mono">{e.text}</span>
              {e.costMs !== undefined && (
                <span
                  className="mono muted"
                  data-testid="cost"
                  title="Stopped until its first beat in the new place"
                >
                  · back in {cost(e.costMs)}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
