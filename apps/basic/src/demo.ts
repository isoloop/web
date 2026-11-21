// basic's side of the site's live demos (isoloop/web ADR 0002, as amended):
// when basic runs embedded (?embed=1, inside a same-origin parent), it reports
// what really happens to the parent page, and takes the demo's controls back.
// The format is `isoloop-demo@1`, documented in README.md.
//
// Everything here uses Isoloop's public API: the activity.v1 topic the
// isolates publish, the other topics' records, and the kernel's isolate:state
// isolate:crash and isolate:failed events; plus the main thread's frame
// times, measured here.
// The controls go back on control.v1, which the isolates subscribe to.
//
// Both directions are checked: messages go only to the parent, with this
// page's own origin as the target; commands are taken only from the parent
// window, from this origin, in the expected shape. Anything else is ignored.
import type { Kernel } from '@isoloop/host';
import type { Budget } from './budget';
import { activity, control, count, note, primes } from './contracts';
import { blockMain } from './panes';

export const PROTOCOL = 'isoloop-demo@1';

/** The commands the parent may send. `restart` names an isolate in `id`. */
export const ACTS = ['block-c', 'crash-a', 'crash-d', 'block-main', 'restart'] as const;
export type Act = (typeof ACTS)[number];
export type Command = { act: Act; id?: string };

/** The isolates a `restart` may name. */
export const IDS = ['A', 'B', 'C', 'D'] as const;

/** Whether this page is the site's embedded demo. */
export function embedded(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    // The examples hub frames the page too, with start=manual: there it's the
    // page itself, waiting for clicks, not the site's demo.
    return (
      window.parent !== window && params.get('embed') === '1' && params.get('start') !== 'manual'
    );
  } catch {
    return false;
  }
}

/** An absolute time in ms, comparable across same-origin documents. */
const now = (): number => performance.timeOrigin + performance.now();

/** A command in the expected shape, or null. */
export function parseCommand(data: unknown): Command | null {
  if (typeof data !== 'object' || data === null) return null;
  if (Reflect.get(data, 'v') !== PROTOCOL || Reflect.get(data, 'type') !== 'command') return null;
  const raw: unknown = Reflect.get(data, 'act');
  const act = ACTS.find((a) => a === raw);
  if (act === undefined) return null;
  if (act !== 'restart') return { act };
  const rawId: unknown = Reflect.get(data, 'id');
  const id = IDS.find((i) => i === rawId);
  return id === undefined ? null : { act, id };
}

export function startDemo(
  kernel: Kernel,
  isolates: readonly { id: string; pool?: string }[],
  budget: Budget,
): void {
  if (!embedded()) return;
  const parent = window.parent;
  const send = (msg: Record<string, unknown>): void => {
    parent.postMessage({ v: PROTOCOL, ...msg }, location.origin);
  };

  send({
    type: 'ready',
    at: now(),
    isolates: isolates.map((i) => ({ id: i.id, pool: i.pool ?? null })),
  });

  kernel.subscribe(activity, (r) => {
    send({ type: 'activity', id: r.producer, at: r.ts, ...r.value });
  });
  const record =
    (topic: string) =>
    (r: { offset: number; producer: string; value: unknown; ts: number }): void => {
      send({
        type: 'record',
        topic,
        offset: r.offset,
        producer: r.producer,
        value: r.value,
        at: r.ts,
      });
    };
  kernel.subscribe(count, record(count.name));
  kernel.subscribe(note, record(note.name));
  kernel.subscribe(primes, record(primes.name));
  kernel.on('isolate:state', (e) => {
    send({ type: 'state', id: e.id, state: e.state, prev: e.prev, at: now() });
  });
  kernel.on('isolate:crash', (e) => {
    send({ type: 'crash', id: e.id, reason: e.reason, pool: e.pool ?? null, at: now() });
  });
  // Restarts used in the current window, as it changes (src/budget.ts).
  // After the crash message it follows: both come from the same isolate:crash.
  budget.on((id, used, cause) => {
    queueMicrotask(() => send({ type: 'budget', id, used, max: 3, cause, at: now() }));
  });
  for (const i of isolates)
    send({ type: 'budget', id: i.id, used: 0, max: 3, cause: 'start', at: now() });
  // Past the restart limit (3 within 60 s by default) the kernel stops
  // restarting it: the crash-loop guard. It stays down until restarted.
  kernel.on('isolate:failed', (e) => {
    send({ type: 'failed', id: e.id, reason: e.reason, pool: e.pool ?? null, at: now() });
  });

  // Frame times, sent in batches. A blocked main thread sends nothing, and the
  // gap shows up in the parent's recording afterwards: they share this thread.
  let frames: number[] = [];
  const frame = (): void => {
    frames.push(now());
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  setInterval(() => {
    if (frames.length === 0) return;
    send({ type: 'frames', times: frames });
    frames = [];
  }, 100);

  window.addEventListener('message', (e) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const cmd = parseCommand(e.data);
    if (cmd === null) return;
    const { act } = cmd;
    if (act === 'restart') {
      if (cmd.id !== undefined) void kernel.restart(cmd.id).catch(() => undefined);
      return;
    }
    if (act === 'block-main') {
      blockMain(3_000);
      return;
    }
    const to = act === 'block-c' ? 'C' : act === 'crash-a' ? 'A' : 'D';
    const what = act === 'block-c' ? 'block' : 'crash';
    void kernel.publish(control, { value: { to, act: what } }).catch(() => undefined);
  });
}
