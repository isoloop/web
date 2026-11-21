// The File processor's state, outside React (M3h decision 29): the
// generator's dials, the processors and where each runs, and what came out:
// queue length, jobs per second, latency per job, duplicates and moves. The
// page reads `snapshot()` ten times a second; every change goes through the
// kernel or the balancer.
import type { Balancer } from '@isoloop/balancer';
import type { Kernel } from '@isoloop/host';
import {
  archiveJobs,
  busy as busyTopic,
  csvJobs,
  dials as dialsTopic,
  hashJobs,
  imageJobs,
  results as resultsTopic,
} from '../contracts';
import type { LogEntry } from '../ui';
import { KINDS, type Kind } from './kinds';

export type Mode = 'balancer' | 'own' | 'one';

/** Processors per kind: each kind's consumer group. */
export const PER_KIND = 2;
const ONE = 'one';
const GENERATOR = 'generator';
const TOPICS = { csv: csvJobs, image: imageJobs, archive: archiveJobs, hash: hashJobs };
/** Jobs per second is counted over this window. */
const RATE_WINDOW_MS = 5_000;
/** Latency percentiles over the last this many results. */
const LATENCY_KEEP = 500;
const RECENT_KEEP = 200;
const LIVE = new Set(['loading', 'running', 'blocked', 'crashed', 'restarting']);
/** How often the page tells the balancer each group's backlog and each processor's busy time (stale after 10 s). */
const REPORT_MS = 1_000;

/** A move, with what it cost once the moved processor beat again (`arrived`). */
export type Move = {
  at: number;
  id: string;
  from: string;
  to: string;
  reason: string;
  costMs?: number;
};

/** A processor the kernel gave up on (past its restart limit), for the comparison (M3j). */
export type GivenUp = {
  at: number;
  id: string;
  kind: Kind;
  reason: string;
  pool: string | undefined;
};

/** A processor crash as the kernel reported it (M3j): what came before a give-up. */
export type Crash = {
  at: number;
  id: string;
  reason: string;
  pool: string | undefined;
  message: string | undefined;
};

/** One processor at one moment, for the comparison's trace (M3i). */
export type TraceRow = {
  id: string;
  pool: string;
  /** The balancer's figure, over 3 s; undefined when it doesn't place this processor. */
  loadPct: number | undefined;
  /** The share of a core from the processor's own reported busy time, as the balancer has it (M3j). */
  reportedPct: number | undefined;
  /** From the last second of beats. */
  measuredPct: number | undefined;
  /** Its kind's files made and not done. */
  backlog: number;
};

export type Dials = {
  running: boolean;
  run: number;
  seed: number;
  /** Files per second. */
  rate: number;
  /** In a hundred files, how many are poison, heavy or corrupt. */
  poison: number;
  heavy: number;
  corrupt: number;
};

export type Result = {
  id: string;
  kind: Kind;
  status: 'ok' | 'corrupt';
  by: string;
  ms: number;
  latency: number;
};

export type ProcessorView = {
  id: string;
  kind: Kind;
  state: string;
  /** Share of one core over the last second of beats; undefined before two beats. */
  load: number | undefined;
  /** Files it finished this run. */
  done: number;
  moved: { reason: string; from: string } | undefined;
};

export type WorkerView = {
  key: string;
  label: string;
  kind: 'pool' | 'quarantine' | 'own';
  lags: number[];
  processors: ProcessorView[];
};

export type KindStats = {
  kind: Kind;
  produced: number;
  done: number;
  queue: number;
  p95: number | undefined;
};

export type Snapshot = {
  mode: Mode;
  dials: Dials;
  produced: number;
  done: number;
  /** Made this run and not done yet: waiting or in progress. */
  queue: number;
  duplicates: number;
  corrupt: number;
  jobsPerSec: number;
  p50: number | undefined;
  p95: number | undefined;
  kinds: KindStats[];
  workers: WorkerView[];
  workerCount: number;
  balancerPools: number;
  maxWorkers: number;
  recent: Result[];
  log: LogEntry[];
};

type Beat = { at: number; busy: number; dur: number };

const percentile = (xs: number[], p: number): number | undefined => {
  if (xs.length === 0) return undefined;
  const s = xs.toSorted((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const rank = (s: string): number =>
  s.startsWith('balancer-quarantine-') ? 2 : s.startsWith('balancer-') || s === ONE ? 0 : 1;
const num = (s: string): number => Number(/(\d+)$/.exec(s)?.[1] ?? 0);
/** Workers: the pools first, then own workers, then the quarantine. */
const order = (a: string, b: string): number => {
  return rank(a) - rank(b) || num(a) - num(b) || a.localeCompare(b);
};

export class FileProcessor {
  /** Set by `attach`: until then the page shows the idle view (start=manual). */
  #kernel: Kernel | undefined;
  /** Absent with `?placement=one-off`: the comparison's baseline for the balancer's own cost. */
  #balancer: Balancer | undefined;
  readonly #src: string;
  readonly #generatorSrc: string;
  readonly #maxWorkers: number;
  /** Each processor's id and kind: `csv-1`, `csv-2`, `image-1`… */
  readonly #kinds = new Map<string, Kind>(
    KINDS.flatMap((k) => Array.from({ length: PER_KIND }, (_, i) => [`${k}-${i + 1}`, k] as const)),
  );
  readonly #ids = [...this.#kinds.keys()];
  #mode: Mode = 'balancer';
  #dials: Dials = { running: false, run: 1, seed: 1, rate: 20, poison: 0, heavy: 0, corrupt: 0 };

  // This run's files and results.
  readonly #produced = new Map<string, Kind>();
  readonly #done = new Map<string, number>();
  readonly #doneBy = new Map<string, number>();
  readonly #finishedAt: number[] = [];
  readonly #latencies: { kind: Kind; ms: number }[] = [];
  readonly #recent: Result[] = [];
  /** Every first result this run, when it arrived: for `since`, the comparison's window. */
  readonly #timeline: { at: number; latency: number; corrupt: boolean }[] = [];
  #corrupt = 0;
  readonly #producedBy = new Map<Kind, number>();
  readonly #doneOf = new Map<Kind, number>();
  #doneCount = 0;
  #duplicates = 0;

  readonly #beats = new Map<string, { last: number; beats: Beat[] }>();
  readonly #lags = new Map<string, { last: number; lags: number[] }>();
  readonly #moved = new Map<string, { reason: string; from: string; at: number }>();
  readonly #log: LogEntry[] = [];
  readonly #movesAt: number[] = [];
  readonly #moves: Move[] = [];
  /** Each processor's own busy time so far, ms, from processor.busy.v1 (M3j). */
  readonly #busy = new Map<string, number>();
  /** Processors the kernel gave up on, in order (M3j). */
  readonly #givenUp: GivenUp[] = [];
  /** Every processor crash, in order (M3j). */
  readonly #crashes: Crash[] = [];
  /** Noted spikes and `behind` events, counted for the comparison (M3i). */
  #noted = 0;
  #behind = 0;

  /**
   * Without a kernel the model draws its initial state and starts nothing, so
   * a page can show its idle view before the reader presses Start; `attach`
   * then starts it. With one, it starts at once, as it always has.
   */
  constructor(opts: {
    kernel?: Kernel | undefined;
    balancer?: Balancer | undefined;
    /** Where the processors start: the balancer, a worker each, or one pool. */
    mode?: Mode;
    dials?: Partial<Omit<Dials, 'run'>>;
    processorSrc: string;
    generatorSrc: string;
    maxWorkers: number;
  }) {
    this.#mode = opts.mode ?? (opts.balancer ? 'balancer' : 'one');
    this.#dials = { ...this.#dials, ...opts.dials };
    this.#src = opts.processorSrc;
    this.#generatorSrc = opts.generatorSrc;
    this.#maxWorkers = opts.maxWorkers;
    if (opts.kernel) this.attach(opts.kernel, opts.balancer);
  }

  /** The kernel, once attached. */
  get #k(): Kernel {
    if (!this.#kernel) throw new Error('FileProcessor: not started (attach a kernel first)');
    return this.#kernel;
  }

  /** Starts the model on a kernel: the generator, the processors, and every subscription. */
  attach(kernel: Kernel, balancer?: Balancer): void {
    if (this.#kernel) throw new Error('FileProcessor: already started');
    if (this.#mode === 'balancer' && !balancer)
      throw new Error('balancer placement needs a balancer');
    this.#kernel = kernel;
    this.#balancer = balancer;

    this.#publishDials();
    this.#k.spawn({
      id: GENERATOR,
      src: this.#generatorSrc,
      grants: {
        publish: KINDS.map((k) => TOPICS[k].name),
        subscribe: [dialsTopic.name],
      },
    });
    for (const id of this.#ids) this.#spawn(id);

    for (const kind of KINDS) {
      this.#k.subscribe(
        TOPICS[kind],
        (r) => {
          if (!this.#ofRun(r.value.id) || this.#produced.has(r.value.id)) return;
          this.#produced.set(r.value.id, kind);
          this.#producedBy.set(kind, (this.#producedBy.get(kind) ?? 0) + 1);
        },
        { from: 'latest' },
      );
    }
    this.#k.subscribe(
      resultsTopic,
      (r) => {
        const v = r.value;
        if (!this.#ofRun(v.id)) return;
        const seen = this.#done.get(v.id) ?? 0;
        this.#done.set(v.id, seen + 1);
        if (seen > 0) {
          this.#duplicates++;
          return;
        }
        this.#doneCount++;
        this.#doneOf.set(v.kind, (this.#doneOf.get(v.kind) ?? 0) + 1);
        this.#doneBy.set(v.by, (this.#doneBy.get(v.by) ?? 0) + 1);
        const latency = v.done - v.created;
        this.#finishedAt.push(performance.now());
        this.#timeline.push({ at: performance.now(), latency, corrupt: v.status === 'corrupt' });
        if (this.#timeline.length > 50_000) this.#timeline.shift();
        if (v.status === 'corrupt') this.#corrupt++;
        else {
          this.#latencies.push({ kind: v.kind, ms: latency });
          if (this.#latencies.length > LATENCY_KEEP) this.#latencies.shift();
        }
        this.#recent.push({
          id: v.id,
          kind: v.kind,
          status: v.status,
          by: v.by,
          ms: v.ms,
          latency,
        });
        if (this.#recent.length > RECENT_KEEP) this.#recent.shift();
      },
      { from: 'latest' },
    );

    this.#k.on('isolate:beat', (e) => {
      const b = this.#beats.get(e.id);
      if (b) {
        b.beats.push({ at: e.at, busy: e.busyMs ?? 0, dur: e.at - b.last });
        if (b.beats.length > 60) b.beats.shift();
        b.last = e.at;
      } else this.#beats.set(e.id, { last: e.at, beats: [] });
      const key = e.pool ?? e.id;
      const l = this.#lags.get(key) ?? { last: -1, lags: [] };
      if (e.at !== l.last) {
        l.lags.push(e.lagMs);
        if (l.lags.length > 60) l.lags.shift();
        l.last = e.at;
      }
      this.#lags.set(key, l);
    });
    this.#balancer?.on('move', (e) => {
      this.#moved.set(e.id, { reason: e.reason, from: e.from, at: performance.now() });
      this.#movesAt.push(performance.now());
      this.#moves.push({ at: performance.now(), ...e });
      this.#entry(e.reason, `${e.id}: ${e.from} → ${e.to}`);
    });
    // What each move cost: from the stop to the first beat in its new place.
    this.#balancer?.on('arrived', (e) => {
      const m = this.#moves.findLast((x) => x.id === e.id && x.costMs === undefined);
      if (m) m.costMs = e.costMs;
      const entry = this.#log.findLast(
        (l) => l.text.startsWith(`${e.id}: `) && l.kind === e.reason,
      );
      if (entry && entry.costMs === undefined) entry.costMs = e.costMs;
    });
    this.#balancer?.on('spike', (e) => {
      if (e.action !== 'noted') return;
      this.#noted++;
      this.#entry('noted', `${e.id}: one long task (${Math.round(e.lagMs)} ms), noted`);
    });
    this.#balancer?.on('behind', (e) => {
      this.#behind++;
      this.#entry('behind', `${e.id}: ${e.backlog} files waiting, nowhere with more CPU`);
    });
    this.#balancer?.on('failed', (e) => {
      this.#entry('failed', `${e.id}: given up by the kernel (${e.reason}), left in ${e.pool}`);
    });
    this.#k.subscribe(
      busyTopic,
      (r) => {
        if (r.key && this.#kinds.has(r.key)) this.#busy.set(r.key, r.value.busyMs);
      },
      { from: 'latest' },
    );
    // Each kind's backlog, reported on every processor of its group (M3i):
    // a group's files belong to the group, not to one member. With it, each
    // processor's own busy time (M3j): its slices after the first run after
    // `await`, which the runtime's busy time doesn't see.
    setInterval(() => {
      const b = this.#balancer;
      if (this.#mode !== 'balancer' || !b) return;
      for (const [id, kind] of this.#kinds) {
        const busyMs = this.#busy.get(id);
        b.report(id, {
          backlog: this.#backlogOf(kind),
          ...(busyMs === undefined ? {} : { busyMs }),
        });
      }
    }, REPORT_MS);
    this.#k.on('isolate:crash', (e) => {
      if (!this.#ids.includes(e.id)) return;
      this.#crashes.push({
        at: performance.now(),
        id: e.id,
        reason: e.reason,
        pool: e.pool,
        message: e.message,
      });
      this.#entry('crash', `${e.id} crashed (${e.reason})`);
    });
    this.#k.on('isolate:failed', (e) => {
      const kind = this.#kinds.get(e.id);
      if (!kind) return;
      this.#givenUp.push({ at: performance.now(), id: e.id, kind, reason: e.reason, pool: e.pool });
      // Without a balancer, the page logs it itself.
      if (this.#mode !== 'balancer')
        this.#entry('failed', `${e.id}: given up by the kernel (${e.reason})`);
    });
  }

  get mode(): Mode {
    return this.#mode;
  }

  /** Changes the generator's dials; the run and seed change only through `newRun`. */
  setDials(d: Partial<Omit<Dials, 'run' | 'seed'>>): void {
    this.#dials = { ...this.#dials, ...d };
    this.#publishDials();
  }

  /** A fresh run: the same seed's files again, from the start, and fresh figures. */
  newRun(seed = this.#dials.seed): void {
    this.#dials = { ...this.#dials, run: this.#dials.run + 1, seed };
    this.#produced.clear();
    this.#done.clear();
    this.#doneBy.clear();
    this.#finishedAt.length = 0;
    this.#latencies.length = 0;
    this.#recent.length = 0;
    this.#timeline.length = 0;
    this.#corrupt = 0;
    this.#producedBy.clear();
    this.#doneOf.clear();
    this.#doneCount = 0;
    this.#duplicates = 0;
    this.#publishDials();
  }

  async setMode(mode: Mode): Promise<void> {
    if (mode === this.#mode || (mode === 'balancer' && !this.#balancer)) return;
    if (!this.#kernel) return;
    const prev = this.#mode;
    this.#mode = mode;
    // Mid-move, the balancer's `stop` cancels the move and waits for the
    // stop (isoloop#209), so every one is gone when this resolves.
    await Promise.all(
      this.#ids.map((id) =>
        prev === 'balancer' && this.#balancer ? this.#balancer.stop(id) : this.#k.stop(id),
      ),
    );
    this.#beats.clear();
    this.#lags.clear();
    this.#moved.clear();
    this.#busy.clear();
    this.#entry('mode', `placement: ${mode}`);
    for (const id of this.#ids) this.#spawn(id);
  }

  /**
   * The files done since `t` (`performance.now()`), for the comparison: how
   * many, and their latency from being made to their result, p50 and p95.
   * Corrupt files count as done but have no latency.
   */
  since(t: number): {
    done: number;
    p50: number | undefined;
    p95: number | undefined;
    moves: number;
  } {
    const done = this.#timeline.filter((r) => r.at >= t);
    const lat = done.filter((r) => !r.corrupt).map((r) => r.latency);
    const moves = this.#movesAt.filter((at) => at >= t).length;
    return { done: done.length, p50: percentile(lat, 50), p95: percentile(lat, 95), moves };
  }

  /** The moves since `t` (`performance.now()`), with their cost where known. */
  movesSince(t: number): Move[] {
    return structuredClone(this.#moves.filter((m) => m.at >= t));
  }

  /** Every processor crash so far, with its reason (M3j). */
  crashes(): Crash[] {
    return structuredClone(this.#crashes);
  }

  /** The processors the kernel gave up on so far, with their kinds (M3j). */
  givenUp(): GivenUp[] {
    return structuredClone(this.#givenUp);
  }

  /** Noted spikes and `behind` events so far. */
  events(): { noted: number; behind: number } {
    return { noted: this.#noted, behind: this.#behind };
  }

  /** Every processor now: where it runs, its load as the balancer and the beats see it, its backlog. */
  trace(): TraceRow[] {
    const now = performance.now();
    const isolates = new Map((this.#kernel?.isolates() ?? []).map((i) => [i.id, i]));
    const placements = new Map((this.#balancer?.placements() ?? []).map((p) => [p.id, p]));
    return this.#ids.map((id) => {
      const placement = placements.get(id);
      const recent = (this.#beats.get(id)?.beats ?? []).filter((b) => b.at > now - 1_000);
      const dur = recent.reduce((s, b) => s + b.dur, 0);
      const busy = recent.reduce((s, b) => s + b.busy, 0);
      return {
        id,
        pool: placement?.pool ?? isolates.get(id)?.pool ?? id,
        loadPct: placement?.loadPct === undefined ? undefined : Math.round(placement.loadPct),
        reportedPct:
          placement?.reportedPct === undefined ? undefined : Math.round(placement.reportedPct),
        measuredPct: dur > 0 ? Math.round(Math.min(100, (busy / dur) * 100)) : undefined,
        backlog: this.#backlogOf(this.#kinds.get(id) ?? 'csv'),
      };
    });
  }

  #backlogOf(kind: Kind): number {
    return Math.max(0, (this.#producedBy.get(kind) ?? 0) - (this.#doneOf.get(kind) ?? 0));
  }

  /** This run's file ids that have no result yet. */
  outstanding(): string[] {
    return [...this.#produced.keys()].filter((id) => !this.#done.has(id));
  }

  snapshot(): Snapshot {
    const now = performance.now();
    while ((this.#finishedAt[0] ?? Infinity) < now - RATE_WINDOW_MS) this.#finishedAt.shift();
    const isolates = new Map((this.#kernel?.isolates() ?? []).map((i) => [i.id, i]));
    const placements = new Map((this.#balancer?.placements() ?? []).map((p) => [p.id, p]));

    const workers = new Map<string, WorkerView>();
    // Before `attach` nothing runs, so no worker is drawn.
    for (const id of this.#kernel ? this.#ids : []) {
      const snap = isolates.get(id);
      const placement = placements.get(id);
      const where =
        this.#mode === 'balancer' ? (placement?.pool ?? snap?.pool ?? '?') : (snap?.pool ?? id);
      let w = workers.get(where);
      if (!w) {
        const kind = where.startsWith('balancer-quarantine-')
          ? 'quarantine'
          : this.#ids.includes(where)
            ? 'own'
            : 'pool';
        w = {
          key: where,
          label: kind === 'own' ? 'own worker' : where,
          kind,
          lags: this.#lags.get(where)?.lags ?? [],
          processors: [],
        };
        workers.set(where, w);
      }
      const recent = (this.#beats.get(id)?.beats ?? []).filter((b) => b.at > now - 1_000);
      const dur = recent.reduce((s, b) => s + b.dur, 0);
      const busy = recent.reduce((s, b) => s + b.busy, 0);
      const moved = this.#moved.get(id);
      w.processors.push({
        id,
        kind: this.#kinds.get(id) ?? 'csv',
        state:
          placement?.state === 'moving' || placement?.state === 'failed'
            ? placement.state
            : (snap?.state ?? 'starting'),
        load: dur > 0 ? Math.min(100, (busy / dur) * 100) : undefined,
        done: this.#doneBy.get(id) ?? 0,
        moved:
          moved && now - moved.at < 6_000 ? { reason: moved.reason, from: moved.from } : undefined,
      });
    }

    const latencies = this.#latencies.map((l) => l.ms);
    const kinds = KINDS.map((kind): KindStats => {
      const produced = this.#producedBy.get(kind) ?? 0;
      const done = this.#doneOf.get(kind) ?? 0;
      return {
        kind,
        produced,
        done,
        queue: Math.max(0, produced - done),
        p95: percentile(
          this.#latencies.filter((l) => l.kind === kind).map((l) => l.ms),
          95,
        ),
      };
    });
    const done = this.#doneCount;
    const live = [...isolates.values()].filter(
      (i) => i.pool === undefined && LIVE.has(i.state),
    ).length;
    const running = (this.#kernel?.pools() ?? []).filter((p) => p.running);
    return {
      mode: this.#mode,
      dials: this.#dials,
      produced: this.#produced.size,
      done,
      queue: Math.max(0, this.#produced.size - done),
      duplicates: this.#duplicates,
      corrupt: this.#corrupt,
      jobsPerSec: this.#finishedAt.length / (RATE_WINDOW_MS / 1_000),
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      kinds,
      workers: [...workers.values()].toSorted((a, b) => order(a.key, b.key)),
      workerCount: this.#kernel ? 1 + live + running.length : 0,
      balancerPools: running.filter(
        (p) => p.name.startsWith('balancer-') && p.name !== 'balancer-quarantine-1',
      ).length,
      maxWorkers: this.#maxWorkers,
      recent: this.#recent.slice(-RECENT_KEEP).toReversed(),
      log: this.#log.slice(-40).toReversed(),
    };
  }

  #ofRun(id: string): boolean {
    return id.startsWith(`${this.#dials.run}-`);
  }

  #spawn(id: string): void {
    const kind = this.#kinds.get(id) ?? 'csv';
    const manifest = {
      id,
      src: this.#src,
      config: { kind },
      grants: {
        publish: [resultsTopic.name, busyTopic.name],
        subscribe: [TOPICS[kind].name],
      },
    };
    if (this.#mode === 'balancer' && this.#balancer) this.#balancer.spawn(manifest);
    else if (this.#mode === 'one') this.#k.spawn({ ...manifest, pool: ONE });
    else this.#k.spawn(manifest);
  }

  #publishDials(): void {
    if (!this.#kernel) return;
    void this.#kernel.publish(dialsTopic, { key: 'dials', value: this.#dials });
  }

  #entry(kind: string, text: string): void {
    this.#log.push({ at: Date.now(), text, kind });
    if (this.#log.length > 200) this.#log.shift();
  }
}
