// The board on the native page (M3e decision 6): the same widgets and form on
// the main thread, over the NativeBus. Placement isn't used.
import { createRoot } from 'react-dom/client';
import { Drawer } from '../drawer/Drawer';
import { NativeWidget } from '../widget/widget';
import type { WidgetConfig } from '../widget/runner';
import { NativeBus, type NativeBusOptions } from './native-bus';
import type { BoardRuntime, Mounted } from './runtime';

function mount(surface: Element, render: (root: ReturnType<typeof createRoot>) => void): Mounted {
  // A fresh child each time, so a respawn never reuses a root.
  const el = document.createElement('div');
  el.className = 'creator-native-root';
  surface.append(el);
  const root = createRoot(el);
  render(root);
  return {
    stop: () => {
      root.unmount();
      el.remove();
      return Promise.resolve();
    },
  };
}

export function nativeRuntime(o: NativeBusOptions): BoardRuntime & { readonly bus: NativeBus } {
  const bus = new NativeBus(o);
  return {
    kind: 'native',
    bus,
    mountWidget: (spec, surface, m) => {
      const config: WidgetConfig = {
        id: m.mode === 'draft' ? (m.draftId ?? spec.id) : spec.id,
        mode: m.mode,
        topic: m.topic,
      };
      return mount(surface, (root) => root.render(<NativeWidget bus={bus} config={config} />));
    },
    mountDrawer: (surface, config) =>
      mount(surface, (root) => root.render(<Drawer bus={bus} config={config} />)),
    where: () => 'main thread',
  };
}
