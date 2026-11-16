import type { Placement } from '../sizes/sizes';
import { WIDGETS } from '../widgets';
import { Boundary } from './Boundary';
import { Head } from './Head';

/** A slot in the native build: the widget itself, in the page's tree. */
export function Slot({
  placement,
  where = 'main thread',
}: {
  placement: Placement;
  where?: string;
}) {
  const W = WIDGETS[placement.widget];
  return (
    <div className="slot widget" data-slot={placement.id} data-widget={placement.widget}>
      <Head slot={placement.id} where={where} />
      <div className="widget-body">
        <Boundary name={placement.id}>
          <W config={placement.config} />
        </Boundary>
      </div>
    </div>
  );
}
