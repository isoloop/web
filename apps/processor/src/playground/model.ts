// The playground's state, outside React: its tasks and their dials, where each
// runs, and what the balancer did. The page reads `snapshot()` ten times a
// second; every change goes through the kernel or the balancer.
import type { Balancer, MoveReason, Placement } from '@isoloop/balancer';
import type { Kernel } from '@isoloop/host';
import { busy as busyTopic, control, done as doneTopic, tasks } from '../contracts';
import { Offences } from '../measuring';

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
/** How often the page tells the balancer each task's backlog and busy time (stale after 10 s). */
const REPORT_MS = 1_000;

/**
 * A task's dials: its CPU, and its jobs (M3i). `reports`: the page passes the
 * task's own busy time to the balancer (M3j); off, the balancer has only the
 * kernel's busy time and the backlog.
 */
type Dial = {
  load: number;
  rate: number;
  hidden: boolean;
  reports: boolean;
  base: number;
  since: number;
};

type Beat = { at: number; busy: number; dur: number };

export type TaskView = {
  id: string;
  name: string;
  /** The dial: the share of one core it's asked to burn, or its jobs need. */
  load: number;
  /** Jobs a second; 0 when it just burns its share. */
  rate: number;
  /** It works after `await`, out of the busy time's sight. */
  hidden: boolean;
  /** The page reports its own busy time to the balancer. */
  reports: boolean;
  /** Jobs arrived and not yet done; undefined when it takes no jobs. */
  backlog: number | undefined;
  /** Measured over the last second of beats, 0–100; undefined before two beats. */
  measured: number | undefined;
  /** The share of a core from the task's own reported busy time, as the balancer has it (M3j). */
  reported: number | undefined;
  state: string;
  placement: Placement | undefined;
  /** Why it last moved, while that's recent. */
  moved: { reason: MoveReason | 'restart' | 'measured'; from: string } | undefined;
  /** In the quarantine to be measured, not for an offence (measuring.ts). */
  measuring: boolean;
};

export type ColumnView = {
  /** The pool's name, or the task's id for an own worker. */
  key: string;
  label: string;
  /** `measuring`: a quarantine holding only tasks being measured (measuring.ts). */
  kind: 'pool' | 'quarantine' | 'measuring' | 'own';
  /** The worker's lag at each recent beat, oldest first. */
  lags: number[];
  tasks: TaskView[];
};

export type LogEntry = {
  at: number;
  text: string;
  kind: MoveReason | 'measured' | 'crash' | 'mode' | 'noted' | 'behind' | 'failed';
  /** A move's cost, once the moved task has beaten in its new place (`arrived`). */
  costMs?: number;
  id?: string;
};

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
  /** Set by `attach`: until then the page shows the idle view (start=manual). */
  #kernel: Kernel | undefined;
  #balancer: Balancer | undefined;
  readonly #src: string;
  readonly #maxWorkers: number;
  readonly #loads: Map<string, number>;
  readonly #dials = new Map<string, Dial>();
  /** Jobs each task has done, from playground.done.v1. */
  readonly #done = new Map<string, number>();
  /** Each task's own busy time so far, ms, from processor.busy.v1 (M3j). */
  readonly #busy = new Map<string, number>();
  readonly #beats = new Map<string, { last: number; beats: Beat[] }>();
  readonly #lags = new Map<string, { last: number; lags: number[] }>();
  readonly #moved = new Map<
    string,
    { reason: MoveReason | 'restart' | 'measured'; from: string; at: number }
  >();
  /** Who has offended, so the measuring step isn't shown as a quarantine stay. */
  readonly #offences = new Offences();
  readonly #log: LogEntry[] = [];
  #mode: Mode = 'balancer';
  #chunkMs = 10;
  #next = 1;

  /**
   * Without a kernel and balancer the model draws its initial state and starts
   * nothing, so a page can show its idle view before the reader presses
   * Start; `attach` then starts it. With them, it starts at once.
   */
  constructor(opts: {
    kernel?: Kernel | undefined;
    balancer?: Balancer | undefined;
    taskSrc: string;
    maxWorkers: number;
    loads: Map<string, number>;
  }) {
    this.#src = opts.taskSrc;
    this.#maxWorkers = opts.maxWorkers;
    this.#loads = opts.loads;
    if (opts.kernel && opts.balancer) this.attach(opts.kernel, opts.balancer);
  }

  /** The kernel, once attached. */
  get #k(): Kernel {
    if (!this.#kernel) throw new Error('Playground: not started (attach a kernel first)');
    return this.#kernel;
  }

  /** The balancer, once attached. */
  get #b(): Balancer {
    if (!this.#balancer) throw new Error('Playground: not started (attach a balancer first)');
    return this.#balancer;
  }

  /** Starts the model on a kernel and its balancer: every subscription and listener. */
  attach(kernel: Kernel, balancer: Balancer): void {
    if (this.#kernel) throw new Error('Playground: already started');
    this.#kernel = kernel;
    this.#balancer = balancer;
    this.#b.on('move', (e) => {
      const kind = this.#offences.move(e);
      this.#moved.set(e.id, { reason: kind, from: e.from, at: performance.now() });
      this.#entry(kind, `${e.id}: ${e.from} → ${e.to}`, e.id);
    });
    // What each move cost the task: stopped until its first beat in the new place.
    this.#b.on('arrived', (e) => {
      const entry = this.#log.findLast(
        (l) =>
          l.id === e.id &&
          (l.kind === e.reason || (e.reason === 'steady' && l.kind === 'measured')),
      );
      if (entry && entry.costMs === undefined) entry.costMs = e.costMs;
    });
    this.#b.on('spike', (e) => {
      this.#offences.spike(e);
      if (e.action === 'noted')
        this.#entry('noted', `${e.id}: one long task (${Math.round(e.lagMs)} ms), noted`, e.id);
    });
    this.#b.on('behind', (e) => {
      this.#entry('behind', `${e.id}: ${e.backlog} jobs waiting, nowhere with more CPU`, e.id);
    });
    // The kernel gave up on it (M3j): the balancer leaves it where it is.
    this.#b.on('failed', (e) => {
      this.#entry(
        'failed',
        `${e.id}: given up by the kernel (${e.reason}), left in ${e.pool}`,
        e.id,
      );
    });
    this.#k.subscribe(
      doneTopic,
      (r) => {
        if (r.key) this.#done.set(r.key, Math.max(this.#done.get(r.key) ?? 0, r.value.done));
      },
      { from: 'earliest' },
    );
    this.#k.subscribe(
      busyTopic,
      (r) => {
        if (r.key && this.#dials.has(r.key)) this.#busy.set(r.key, r.value.busyMs);
      },
      { from: 'latest' },
    );
    // The backlog (M3i) and the task's own busy time (M3j) go to the balancer
    // as a report; only it can place them.
    setInterval(() => {
      if (this.#mode !== 'balancer') return;
      for (const [id, d] of this.#dials) {
        const backlog =
          d.rate > 0 || (this.backlog(id) ?? 0) > 0 ? (this.backlog(id) ?? 0) : undefined;
        const busyMs = d.reports ? this.#busy.get(id) : undefined;
        if (backlog === undefined && busyMs === undefined) continue;
        this.#b.report(id, {
          ...(backlog === undefined ? {} : { backlog }),
          ...(busyMs === undefined ? {} : { busyMs }),
        });
      }
    }, REPORT_MS);
    // Every heartbeat as it arrives (ADR 0017): each task's busy time, and
    // each worker's lag once per beat (a pool's members share one beat).
    this.#k.on('isolate:beat', (e) => {
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
    this.#k.on('isolate:crash', (e) => {
      if (!this.#dials.has(e.id)) return;
      this.#offences.crash(e.id);
      this.#entry('crash', `${e.id} crashed (${e.reason})`);
    });
  }

  get count(): number {
    return this.#dials.size;
  }

  add(load: number, rate = 0, hidden = false, reports = true): string | undefined {
    if (this.#dials.size >= MAX_TASKS) return undefined;
    const id = `task-${this.#next++}`;
    this.#dials.set(id, { load, rate, hidden, reports, base: 0, since: Date.now() });
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
    this.#done.delete(id);
    this.#busy.delete(id);
    this.#moved.delete(id);
    this.#offences.forget(id);
    await (this.#mode === 'balancer' ? this.#b.stop(id) : this.#k.stop(id));
  }

  setLoad(id: string, load: number): void {
    const d = this.#dials.get(id);
    if (!d) return;
    d.load = load;
    this.#publish(id);
  }

  /** Jobs a second; the arrivals so far carry over, so the backlog doesn't jump. */
  setRate(id: string, rate: number): void {
    const d = this.#dials.get(id);
    if (!d) return;
    d.base = arrivals(d, Date.now());
    d.since = Date.now();
    d.rate = rate;
    this.#publish(id);
  }

  setHidden(id: string, hidden: boolean): void {
    const d = this.#dials.get(id);
    if (!d) return;
    d.hidden = hidden;
    this.#publish(id);
  }

  /** Whether the page reports the task's own busy time to the balancer (M3j). */
  setReports(id: string, reports: boolean): void {
    const d = this.#dials.get(id);
    if (d) d.reports = reports;
  }

  /** Every slider back to idle: no CPU and no jobs, to watch tasks pack back. */
  calm(): void {
    for (const id of this.#dials.keys()) {
      this.setRate(id, 0);
      this.setLoad(id, 0);
    }
  }

  /** Jobs arrived and not yet done; undefined for a task that has never taken jobs. */
  backlog(id: string): number | undefined {
    const d = this.#dials.get(id);
    if (!d || (d.rate === 0 && d.base === 0)) return undefined;
    return Math.max(0, arrivals(d, Date.now()) - (this.#done.get(id) ?? 0));
  }

  setChunk(ms: number): void {
    this.#chunkMs = ms;
    for (const id of this.#dials.keys()) this.#publish(id);
  }

  block(id: string, ms = 2_000): void {
    void this.#k.publish(control, { value: { to: id, act: 'block', ms } });
  }

  crash(id: string): void {
    void this.#k.publish(control, { value: { to: id, act: 'crash' } });
  }

  async setMode(mode: Mode): Promise<void> {
    if (mode === this.#mode) return;
    const ids = [...this.#dials.keys()];
    const prev = this.#mode;
    this.#mode = mode;
    // Mid-move, the balancer's `stop` cancels the move and waits for the
    // stop (isoloop#209), so every one is gone when this resolves.
    await Promise.all(ids.map((id) => (prev === 'balancer' ? this.#b.stop(id) : this.#k.stop(id))));
    this.#beats.clear();
    this.#lags.clear();
    this.#moved.clear();
    this.#offences.clear();
    this.#busy.clear();
    this.#entry('mode', `placement: ${mode}`);
    for (const id of ids) if (this.#dials.has(id)) this.#spawn(id);
  }

  snapshot(): Snapshot {
    const now = performance.now();
    const isolates = this.#kernel?.isolates() ?? [];
    const byId = new Map(isolates.map((i) => [i.id, i]));
    const placements = new Map((this.#balancer?.placements() ?? []).map((p) => [p.id, p]));

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

    for (const [id, dial] of this.#dials) {
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
        load: dial.load,
        rate: dial.rate,
        hidden: dial.hidden,
        reports: dial.reports,
        backlog: this.backlog(id),
        measured: dur > 0 ? Math.min(100, (busy / dur) * 100) : undefined,
        reported: placement?.reportedPct,
        state:
          placement?.state === 'moving' || placement?.state === 'failed'
            ? placement.state
            : (snap?.state ?? 'starting'),
        placement,
        moved:
          moved && now - moved.at < BADGE_MS
            ? { reason: moved.reason, from: moved.from }
            : undefined,
        measuring: this.#mode === 'balancer' && this.#offences.measuring(id, where),
      });
    }
    // A quarantine holding only tasks being measured is the measuring step, not a quarantine.
    for (const c of columns.values()) {
      if (c.kind === 'quarantine' && c.tasks.every((t) => t.measuring)) {
        c.kind = 'measuring';
        c.label = `Measuring · ${c.key}`;
      }
    }

    const live = isolates.filter((i) => i.pool === undefined && LIVE.has(i.state)).length;
    const running = (this.#kernel?.pools() ?? []).filter((p) => p.running);
    const pools = running.length;
    const balancerPools = running.filter(
      (p) => p.name.startsWith('balancer-') && p.name !== 'balancer-quarantine-1',
    ).length;
    return {
      mode: this.#mode,
      chunkMs: this.#chunkMs,
      columns: [...columns.values()].toSorted((a, b) => order(a.key, b.key)),
      workers: this.#kernel ? 1 + live + pools : 0,
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
      grants: {
        publish: [doneTopic.name, busyTopic.name],
        subscribe: [tasks.name, control.name, doneTopic.name],
      },
    };
    if (this.#mode === 'balancer') this.#b.spawn(manifest);
    else if (this.#mode === 'one') this.#k.spawn({ ...manifest, pool: ONE });
    else this.#k.spawn(manifest);
  }

  #publish(id: string): void {
    const d = this.#dials.get(id);
    if (!d) return;
    void this.#k.publish(tasks, {
      key: id,
      value: {
        load: d.load,
        chunkMs: this.#chunkMs,
        rate: d.rate,
        base: d.base,
        since: d.since,
        hidden: d.hidden,
      },
    });
  }

  #entry(kind: LogEntry['kind'], text: string, id?: string): void {
    this.#log.push(
      id === undefined ? { at: Date.now(), text, kind } : { at: Date.now(), text, kind, id },
    );
    if (this.#log.length > 200) this.#log.shift();
  }
}

/** Jobs arrived by `now` (epoch ms), as the task counts them. */
function arrivals(d: Dial, now: number): number {
  return d.rate > 0 ? Math.floor(d.base + ((now - d.since) / 1_000) * d.rate) : Math.floor(d.base);
}
