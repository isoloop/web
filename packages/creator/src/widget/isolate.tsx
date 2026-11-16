// The widget isolate (M3e decision 9): one per widget, and one for the
// drawer's preview. A page imports its URL with the Vite `?isolate` query:
//
//   import widgetSrc from 'creator/widget-isolate?isolate';
//
// and spawns it with spawnWidget (host.ts).
import { defineIsolate, useIsolate } from '@isoloop/react';
import { useEffect, useMemo } from 'react';
import css from '../styles.css?inline';
import { ViewEnv } from '../views/env';
import { widgetConfig } from './config';
import { useIsolateCanvas } from './isolate-canvas';
import { isolateBus } from './bus';
import { Widget } from './widget';

function WidgetIsolate({ config }: { config: unknown }) {
  const ctx = useIsolate();
  const { bus } = ctx;
  useEffect(() => ctx.styles(css), [ctx]);
  const cfg = useMemo(() => widgetConfig(config), [config]);
  const wbus = useMemo(() => isolateBus(bus), [bus]);
  return (
    <ViewEnv useCanvas={useIsolateCanvas}>
      <Widget bus={wbus} config={cfg} />
    </ViewEnv>
  );
}

export default defineIsolate(WidgetIsolate);
