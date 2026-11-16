import type { FunctionComponent } from 'react';
import { createRoot } from 'react-dom/client';
import { Boundary } from '../slot/Boundary';
import type { PartModule } from './contract';
import { connect } from './env';

/**
 * A part's `mount`: the widget in its own Preact root, inside its own error
 * boundary (M3g decision 5), as a team shipping a part would write it.
 */
export function definePart(W: FunctionComponent<{ config?: unknown }>): PartModule['mount'] {
  return (el, host, { slot, config }) => {
    connect(host);
    const root = createRoot(el);
    root.render(
      <Boundary name={slot}>
        <W config={config} />
      </Boundary>,
    );
    return () => {
      root.unmount();
    };
  };
}
