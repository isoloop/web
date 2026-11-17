// Automatic placement on an interactive page (M3h decisions 3, 5, 12, 17 and
// 20): the page's balancer, seen by the board. The board knows widgets by id;
// the balancer knows isolates (`widget-<id>`) and its pools (`balancer-2`).
// This turns one into the other, holds a widget while the drawer edits it,
// and stores a preview's measured load as the widget's on Save.
//
// The creator doesn't depend on @isoloop/balancer: the page creates the
// balancer and passes it in, typed by the part of its API used here.
import type { IsolateManifest } from '@isoloop/host';
import { isolateIdOf, widgetIdOf } from '../widget/host';
import type { AutoPlacement } from './ui';

/** What the board uses of `@isoloop/balancer`'s `Balancer` (ADR 0017). */
export interface BalancerLike {
  spawn(manifest: IsolateManifest): unknown;
  stop(id: string): Promise<void>;
  placements(): readonly {
    readonly id: string;
    readonly pool: string;
    readonly state: AutoPlacement['state'];
    readonly atCap?: true;
  }[];
  measure(id: string): number | undefined;
  hold(id: string): () => void;
  on(
    event: 'move',
    fn: (e: { id: string; from: string; to: string; reason: MoveReason }) => void,
  ): () => void;
}

/**
 * Why the balancer moved a widget (ADR 0017): one long task (`spike`), the
 * pool's lag stayed high (`sustained`), its members' busy time reached 80 %
 * of a core (`full`), a crash, a search for an unnamed culprit (`bisect`),
 * back out of quarantine (`steady`), a backlog that kept rising (`backlog`),
 * or joining another pool to free a worker (`pack`).
 */
export type MoveReason =
  | 'spike'
  | 'sustained'
  | 'full'
  | 'crash'
  | 'bisect'
  | 'steady'
  | 'backlog'
  | 'pack';

/** A move, by widget id, with its pools as the page shows them. */
export type AutoMove = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly reason: MoveReason;
  /** When the board heard of it (ms since the epoch). */
  readonly at: number;
};

/** The load store the balancer reads and writes (`loads`), plus a delete for removed widgets. */
export interface LoadsLike {
  get(id: string): number | undefined;
  set(id: string, loadPct: number): void;
  delete(id: string): void;
}

const NUMBERED = /^balancer-(\d+)$/;
const QUARANTINE = /^balancer-quarantine-(\d+)$/;

/** "Auto 2" for `balancer-2`, "Quarantine" for `balancer-quarantine-1`, "Quarantine 2" after it. */
export function balancerLabel(pool: string): string {
  const n = NUMBERED.exec(pool);
  if (n) return `Auto ${n[1]}`;
  const q = QUARANTINE.exec(pool);
  if (q) return q[1] === '1' ? 'Quarantine' : `Quarantine ${q[1]}`;
  return pool;
}

/** The widget header's badge for a move: "moved: Auto 1 was over budget". */
export function moveText(m: Pick<AutoMove, 'from' | 'to' | 'reason'>): string {
  const text: Record<MoveReason, string> = {
    sustained: `moved: ${m.from} was over budget`,
    full: `moved: ${m.from} was full`,
    spike: `moved to ${m.to}: it blocked ${m.from}`,
    crash: `moved to ${m.to}: it crashed ${m.from}`,
    bisect: `moved to ${m.to}: finding what blocked ${m.from}`,
    steady: `back in ${m.to}: steady`,
    backlog: `moved: falling behind in ${m.from}`,
    pack: `packed into ${m.to}: quiet`,
  };
  return text[m.reason];
}

/** The board's view of the balancer. */
export interface AutoPlacer {
  /** Spawns an `auto` widget's isolate where the balancer puts it. */
  spawn(manifest: IsolateManifest): { stop(): Promise<void> };
  /** Every `auto` widget the balancer runs, by widget id. */
  placements(): Map<string, AutoPlacement>;
  /** Calls `fn` on every move of a widget; returns the unsubscribe function. */
  onMove(fn: (m: AutoMove) => void): () => void;
  /** Leaves widget `id` where it is until the returned function is called. */
  hold(id: string): () => void;
  /** On Save: the preview `draftId`'s measured load becomes widget `id`'s (decision 12). */
  measured(id: string, draftId: string): void;
  /** Widget `id` was deleted: its load goes. */
  forget(id: string): void;
}

export function autoPlacer(
  balancer: BalancerLike,
  loads: LoadsLike,
  now: () => number = Date.now,
): AutoPlacer {
  return {
    spawn: (manifest) => {
      balancer.spawn(manifest);
      return { stop: () => balancer.stop(manifest.id) };
    },
    placements: () => {
      const out = new Map<string, AutoPlacement>();
      for (const p of balancer.placements()) {
        const id = widgetIdOf(p.id);
        if (id === undefined) continue;
        out.set(id, {
          id,
          pool: p.pool,
          label: balancerLabel(p.pool),
          state: p.state,
          ...(p.atCap ? { atCap: true } : {}),
        });
      }
      return out;
    },
    onMove: (fn) =>
      balancer.on('move', (e) => {
        const id = widgetIdOf(e.id);
        if (id === undefined) return;
        fn({
          id,
          from: balancerLabel(e.from),
          to: balancerLabel(e.to),
          reason: e.reason,
          at: now(),
        });
      }),
    hold: (id) => balancer.hold(isolateIdOf('spec', id)),
    measured: (id, draftId) => {
      const pct = balancer.measure(isolateIdOf('draft', draftId));
      if (pct !== undefined) loads.set(isolateIdOf('spec', id), pct);
    },
    forget: (id) => loads.delete(isolateIdOf('spec', id)),
  };
}
