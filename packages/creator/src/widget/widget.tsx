// A widget as React: the runner, read every READ_EVERY_MS, drawn by its view.
// The same component runs in a widget isolate (isolate.tsx) and on the
// native page (NativeWidget); only the bus and the canvas differ.
import { useEffect, useState, type ReactElement } from 'react';
import { useMainThreadCanvas, ViewEnv } from '../views/env';
import { View } from '../views/registry';
import {
  READ_EVERY_MS,
  WidgetRunner,
  type WidgetBus,
  type WidgetConfig,
  type WidgetState,
} from './runner';

/** The runner's state, re-read every READ_EVERY_MS and on every spec record. */
export function useWidget(bus: WidgetBus, config: WidgetConfig): WidgetState {
  const [state, setState] = useState<WidgetState>({ status: 'waiting' });
  useEffect(() => {
    const runner = new WidgetRunner(bus, config, { onChange: setState });
    runner.start();
    const timer = setInterval(() => setState(runner.tick()), READ_EVERY_MS);
    return () => {
      clearInterval(timer);
      runner.stop();
    };
  }, [bus, config]);
  return state;
}

/**
 * A widget: nothing while it waits for its spec or after a tombstone, else
 * its view. `data-state` is the runner's status, for the page and E2E tests.
 * Needs a <ViewEnv> around it for canvas views.
 */
export function Widget({ bus, config }: { bus: WidgetBus; config: WidgetConfig }): ReactElement {
  const state = useWidget(bus, config);
  const spec = state.status === 'live' || state.status === 'respawn' ? state.spec : undefined;
  const output = state.status === 'live' || state.status === 'respawn' ? state.output : undefined;
  return (
    <div className="creator-widget" data-widget={config.id} data-state={state.status}>
      {spec ? (
        <View
          type={spec.view.type}
          size={spec.view.size}
          options={spec.view.options}
          title={spec.title}
          output={output}
        />
      ) : null}
    </div>
  );
}

/** The native build's widget: the same component, drawn on the main thread. */
export function NativeWidget(props: { bus: WidgetBus; config: WidgetConfig }): ReactElement {
  return (
    <ViewEnv useCanvas={useMainThreadCanvas}>
      <Widget {...props} />
    </ViewEnv>
  );
}
