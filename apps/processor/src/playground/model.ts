// The playground's state, outside React: its tasks and their dials, where each
// runs, and what the balancer did. The page reads `snapshot()` ten times a
// second; every change goes through the kernel or the balancer.
import type { Balancer, MoveReason, Placement } from '@isoloop/balancer';
import type { Kernel } from '@isoloop/host';
import { control, tasks } from '../contracts';

export type Mode = 'balancer' | 'own' | 'one';

export const MAX_TASKS = 24;
/** The pool every task joins in `one` mode. */
const ONE = 'one';
/** Kept per task and per pool: about 6 s of beats. */
const KEEP = 60;
/** How long a moved card shows why it moved. */
const BADGE_MS = 6_000;
/** Kernel states in which an isolate holds a worker. */
const LIVE = new Set(['loading', 'running', 'blocked', 'crashed', 'restarting']);

type Beat = { at: number; busy: number; dur: number };

export type TaskView = {
  id: string;
  name: string;
  /** The dial: the share of one core it's asked to burn. */
  load: number;
  /** Measured over the last second of beats, 0–100; undefined before two beats. */
  measured: number | undefined;
  state: string;
  placement: Placement | undefined;
  /** Why it last moved, while that's recent. */
  moved: { reason: MoveReason | 'restart'; from: string } | undefined;
};

export type ColumnView = {
  /** The pool's name, or the task's id for an own worker. */
  key: string;
  label: string;
  kind: 'pool' | 'quarantine' | 'own';
  /** The worker's lag at each recent beat, oldest first. */
  lags: number[];
  tasks: TaskView[];
};

export type LogEntry = { at: number; text: string; kind: MoveReason | 'crash' | 'mode' };

export type Snapshot = {
  mode: Mode;
  chunkMs: number;
  columns: ColumnView[];
  /** Every worker on the page, the bus included. */
  workers: number;
  /** The balancer's own pools: its allowance counts these (the first quarantine is on top). */
  balancerPools: number;
  maxWorkers: number;
  log: LogEntry[];
  count: number;
};

const rank = (s: string): number => (s.startsWith('balancer-quarantine-') ? 1 : 0);
const num = (s: string): number => Number(/(\d+)$/.exec(s)?.[1] ?? 0);
/** Columns: the balancer's pools by number, then its quarantines, then the rest. */
const order = (a: string, b: string): number => {
  return rank(a) - rank(b) || num(a) - num(b) || a.localeCompare(b);
};

export class Playground {
  readonly #kernel: Kernel;
  readonly #balancer: Balancer;
  readonly #src: string;
  readonly #maxWorkers: number;
  readonly #loads: Map<string, number>;
  readonly #dials = new Map<string, number>();
  readonly #beats = new Map<string, { last: number; beats: Beat[] }>();
  readonly #lags = new Map<string, { last: number; lags: number[] }>();
  readonly #moved = new Map<string, { reason: MoveReason | 'restart'; from: string; at: number }>();
  readonly #log: LogEntry[] = [];
  #mode: Mode = 'balancer';
  #chunkMs = 10;
  #next = 1;

  constructor(opts: {
    kernel: Kernel;
    balancer: Balancer;
    taskSrc: string;
    maxWorkers: number;
    loads: Map<string, number>;
  }) {
    this.#kernel = opts.kernel;
    this.#balancer = opts.balancer;
    this.#src = opts.taskSrc;
    this.#maxWorkers = opts.maxWorkers;
    this.#loads = opts.loads;
    this.#balancer.on('move', (e) => {
      this.#moved.set(e.id, { reason: e.reason, from: e.from, at: performance.now() });
      this.#entry(e.reason, `${e.id}: ${e.from} → ${e.to}`);
    });
    // Every heartbeat as it arrives (ADR 0017): each task's busy time, and
    // each worker's lag once per beat (a pool's members share one beat).
    this.#kernel.on('isolate:beat', (e) => {
      if (!this.#dials.has(e.id)) return;
      const b = this.#beats.get(e.id);
      if (b) {
        b.beats.push({ at: e.at, busy: e.busyMs ?? 0, dur: e.at - b.last });
        if (b.beats.length > KEEP) b.beats.shift();
        b.last = e.at;
      } else this.#beats.set(e.id, { last: e.at, beats: [] });
      const key = e.pool ?? e.id;
      const l = this.#lags.get(key) ?? { last: -1, lags: [] };
      if (e.at !== l.last) {
        l.lags.push(e.lagMs);
        if (l.lags.length > KEEP) l.lags.shift();
        l.last = e.at;
      }
      this.#lags.set(key, l);
    });
    this.#kernel.on('isolate:crash', (e) => {
      if (!this.#dials.has(e.id)) return;
      this.#entry('crash', `${e.id} crashed (${e.reason})`);
    });
  }

  get count(): number {
    return this.#dials.size;
  }

  add(load: number): string | undefined {
    if (this.#dials.size >= MAX_TASKS) return undefined;
    const id = `task-${this.#next++}`;
    this.#dials.set(id, load);
    // The dial is the task's declared load until the balancer has measured
    // it, so it's placed at once instead of waiting in quarantine.
    this.#loads.set(id, load);
    this.#publish(id);
    this.#spawn(id);
    return id;
  }

  async remove(id: string): Promise<void> {
    if (!this.#dials.delete(id)) return;
    this.#beats.delete(id);
    this.#moved.delete(id);
    await (this.#mode === 'balancer' ? this.#balancer.stop(id) : this.#kernel.stop(id));
  }

  setLoad(id: string, load: number): void {
    if (!this.#dials.has(id)) return;
    this.#dials.set(id, load);
    this.#publish(id);
  }

  setChunk(ms: number): void {
    this.#chunkMs = ms;
    for (const id of this.#dials.keys()) this.#publish(id);
  }

  block(id: string, ms = 2_000): void {
    void this.#kernel.publish(control, { value: { to: id, act: 'block', ms } });
  }

  crash(id: string): void {
    void this.#kernel.publish(control, { value: { to: id, act: 'crash' } });
  }

  async setMode(mode: Mode): Promise<void> {
    if (mode === this.#mode) return;
    const ids = [...this.#dials.keys()];
    const prev = this.#mode;
    this.#mode = mode;
    // Mid-move, the balancer's `stop` cancels the move and waits for the
    // stop (isoloop#209), so every one is gone when this resolves.
    await Promise.all(
      ids.map((id) => (prev === 'balancer' ? this.#balancer.stop(id) : this.#kernel.stop(id))),
    );
    this.#beats.clear();
    this.#lags.clear();
    this.#moved.clear();
    this.#entry('mode', `placement: ${mode}`);
    for (const id of ids) if (this.#dials.has(id)) this.#spawn(id);
  }

  snapshot(): Snapshot {
    const now = performance.now();
    const isolates = this.#kernel.isolates();
    const byId = new Map(isolates.map((i) => [i.id, i]));
    const placements = new Map(this.#balancer.placements().map((p) => [p.id, p]));

    const columns = new Map<string, ColumnView>();
    const column = (key: string): ColumnView => {
      let c = columns.get(key);
      if (!c) {
        const kind = key.startsWith('balancer-quarantine-')
          ? 'quarantine'
          : this.#dials.has(key)
            ? 'own'
            : 'pool';
        const label = kind === 'own' ? 'own worker' : key;
        c = { key, label, kind, lags: this.#lags.get(key)?.lags ?? [], tasks: [] };
        columns.set(key, c);
      }
      return c;
    };

    for (const [id, load] of this.#dials) {
      const snap = byId.get(id);
      const placement = placements.get(id);
      const where =
        this.#mode === 'balancer' ? (placement?.pool ?? snap?.pool ?? '?') : (snap?.pool ?? id);
      const recent = (this.#beats.get(id)?.beats ?? []).filter((b) => b.at > now - 1_000);
      const dur = recent.reduce((s, b) => s + b.dur, 0);
      const busy = recent.reduce((s, b) => s + b.busy, 0);
      const moved = this.#moved.get(id);
      column(where).tasks.push({
        id,
        name: id.replace('task-', 'Task '),
        load,
        measured: dur > 0 ? Math.min(100, (busy / dur) * 100) : undefined,
        state: placement?.state === 'moving' ? 'moving' : (snap?.state ?? 'starting'),
        placement,
        moved:
          moved && now - moved.at < BADGE_MS
            ? { reason: moved.reason, from: moved.from }
            : undefined,
      });
    }

    const live = isolates.filter((i) => i.pool === undefined && LIVE.has(i.state)).length;
    const running = this.#kernel.pools().filter((p) => p.running);
    const pools = running.length;
    const balancerPools = running.filter(
      (p) => p.name.startsWith('balancer-') && p.name !== 'balancer-quarantine-1',
    ).length;
    return {
      mode: this.#mode,
      chunkMs: this.#chunkMs,
      columns: [...columns.values()].toSorted((a, b) => order(a.key, b.key)),
      workers: 1 + live + pools,
      balancerPools,
      maxWorkers: this.#maxWorkers,
      log: this.#log.slice(-40).toReversed(),
      count: this.#dials.size,
    };
  }

  #spawn(id: string): void {
    const manifest = {
      id,
      src: this.#src,
      grants: { publish: [], subscribe: [tasks.name, control.name] },
    };
    if (this.#mode === 'balancer') this.#balancer.spawn(manifest);
    else if (this.#mode === 'one') this.#kernel.spawn({ ...manifest, pool: ONE });
    else this.#kernel.spawn(manifest);
  }

  #publish(id: string): void {
    const load = this.#dials.get(id) ?? 0;
    void this.#kernel.publish(tasks, { key: id, value: { load, chunkMs: this.#chunkMs } });
  }

  #entry(kind: LogEntry['kind'], text: string): void {
    this.#log.push({ at: Date.now(), text, kind });
    if (this.#log.length > 200) this.#log.shift();
  }
}
