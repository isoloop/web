import { useCanvas } from '#env';
import { useEffect, useRef, useState } from 'react';
import { drawChart, type ChartOptions, type Series } from '../charts/canvas-chart';
import { timed, useCountDraw, useRecordTime } from '../metrics/timing';

/** A canvas chart: the context comes from the build (#env), the drawing is shared. */
export function Chart({ series, options }: { series: readonly Series[]; options: ChartOptions }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { ctx, width, height } = useCanvas(ref);
  const record = useRecordTime();
  const counted = useCountDraw();
  // Set once, when the chart first draws a point, so tests can tell a chart
  // with data from an empty one without a DOM change on every draw.
  const [hasData, setHasData] = useState(false);
  useEffect(() => {
    if (ctx) {
      counted();
      timed(record, () => {
        drawChart(ctx, width, height, series, options);
      });
      if (!hasData && series.some((s) => s.points.length > 0)) setHasData(true);
    }
  }, [ctx, width, height, series, options, record, counted, hasData]);
  return <canvas ref={ref} className="chart" data-drawn={hasData ? 'data' : undefined} />;
}
