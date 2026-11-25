// The recording (ADR 0002, as amended): a profiler-style timeline of basic,
// drawn from what it really reports over isoloop-demo@1.
//
// - A, B and the pool's C and D: a bar for each task an isolate reports
//   (activity.v1), as long as the task took. A blocked isolate reports
//   nothing: that's the gap.
// - The bus: a tick for each record of the app's topics (count, primes, note),
//   and a red one for a publish the bus rejected. The demo's own measurement
//   records (activity, budget, control) aren't drawn: they'd echo every task.
// - A hollow tick is a reaction: a task that handled another isolate's record
//   (C and D reading A's count). A thin line points back to the record's
//   publisher. Work an isolate does on its own timer is a solid bar.
// - While A is down (from the kernel's isolate:state), C's and D's rows say
//   "no count from A": they aren't stuck, they have no input.
// - The main thread: a tick per frame of this page. basic is a same-origin
//   iframe, so it shares this thread: when it blocks it, nothing draws, and the
//   gap is hatched afterwards. Frames are counted here, not from basic's
//   `frames`: browsers may slow requestAnimationFrame in an out-of-view iframe
//   (Firefox to about 1 a second), which would read as a stuck thread.
// - Hatching while the kernel says an isolate is `blocked`; a line where it
//   crashed and was started again (isolate:crash).
// - A red span while it's `failed`: more than 3 crashes within a minute, and
//   the kernel's crash-loop guard stopped restarting it (isolate:failed).
// - Each control shows the restarts its isolate has used this minute, as basic
//   counts them (`budget`); once it's failed, the control becomes Restart,
//   which sends basic `restart` (kernel.restart(id)).
import { recording as copy } from '../copy.ts';
import { type Channel, type Message, num, reducedMotion, str, whileVisible } from './channel.ts';

const TRACKS = ['main', 'bus', 'A', 'B', 'pool'] as const;
type Track = (typeof TRACKS)[number];
type Kind = 'task' | 'reaction' | 'rejected' | 'stuck' | 'stalled' | 'failed';
type Bar = { track: Track; row: number; start: number; end: number; kind: Kind; label?: string };
type Mark = { t: number; track: Track; text: string };
/** A reaction's link: from the record's publisher, when it published, to the task that read it. */
type Link = { from: [Track, number]; t0: number; to: [Track, number]; t1: number };
/** States in which A publishes nothing. */
const DOWN: ReadonlySet<string> = new Set([
  'loading',
  'restarting',
  'crashed',
  'failed',
  'stopped',
]);

/** Where each isolate draws: its track and row. */
const PLACE: Record<string, [Track, number]> = {
  A: ['A', 0],
  B: ['B', 0],
  C: ['pool', 0],
  D: ['pool', 1],
};
/** The isolates each control acts on. */
/** Width of the strip at the pool rows' left edge that holds the C and D names. */
const POOL_LABELS = 22;

const TARGETS: Record<string, string[]> = { 'crash-a': ['A'], 'block-c': ['C', 'D'] };
/** A gap between frames this long is a stuck main thread. */
const MAIN_STUCK_MS = 250;

export class Recording {
  readonly #root: HTMLElement;
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #status: HTMLElement;
  readonly #channel: Channel;
  #rows = new Map<Track, [number, number]>();
  #bars: Bar[] = [];
  #marks: Mark[] = [];
  #links: Link[] = [];
  /** Records seen, by topic and offset: who published them, and when. */
  #records = new Map<string, { producer: string; t: number }>();
  /** Reads whose record hasn't arrived yet. */
  #pending = new Map<string, { to: [Track, number]; t1: number }>();
  /** Since when A has been down, while it is. */
  #upDown: number | undefined;
  /** Counts for the smoke test, on the root's dataset. */
  #counts = { bus: 0, links: 0, stuck: 0 };
  #open = new Map<string, Bar>();
  /** Failed isolates, in the order they failed, and their spans. */
  #down = new Map<string, Bar>();
  /** Restarts each isolate has used this minute, as basic counts them. */
  #used = new Map<string, number>();
  /** The last crash status said, to add the count to when it arrives. */
  #crashSaid: { ids: string[]; text: string } | undefined;
  #lastFrame: number | undefined;
  #colors: Record<string, string> = {};
  #patterns = new Map<string, CanvasPattern | null>();
  #window = 4000;
  #visible = false;
  #running = false;
  #counting = false;
  #w = 0;
  #h = 0;
  #blockMainAt: number | undefined;

  constructor(root: HTMLElement, channel: Channel) {
    this.#root = root;
    const canvas = root.querySelector('canvas');
    const status = root.querySelector<HTMLElement>('.ui-status');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !status || !ctx) throw new Error('recording: markup missing');
    this.#canvas = canvas;
    this.#ctx = ctx;
    this.#status = status;
    this.#channel = channel;
    this.#readColors();
    this.#measure();
    new MutationObserver(() => {
      this.#readColors();
      this.#draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      this.#readColors();
    });
    window.addEventListener('resize', () => {
      this.#measure();
      this.#draw();
    });
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-act]')) {
      button.dataset['base'] = button.textContent ?? '';
      button.addEventListener('click', () => this.#act(button));
    }
    this.#label();
    channel.on((m) => this.#receive(m));
    whileVisible(root, (v) => {
      this.#visible = v;
      if (v) {
        this.#loop();
        this.#count();
      }
    });
    document.addEventListener('visibilitychange', () => {
      // A hidden tab has no frames: that's not a stuck thread.
      this.#lastFrame = undefined;
      if (!document.hidden && this.#visible) this.#count();
    });
    if (reducedMotion()) {
      // Updates without animating: one still frame a second.
      setInterval(() => {
        if (this.#visible) this.#draw();
      }, 1000);
    }
  }

  #say(text: string): void {
    this.#status.textContent = text;
  }

  #readColors(): void {
    const cs = getComputedStyle(this.#root);
    for (const [k, v] of Object.entries({
      main: '--ui-part-host',
      bus: '--ui-part-bus',
      A: '--ui-part-isolate',
      B: '--ui-accent',
      pool: '--ui-part-pool',
      ink: '--ui-text',
      muted: '--ui-text-muted',
      rule: '--ui-rule',
      panel: '--ui-surface',
      bad: '--ui-bad',
    }))
      this.#colors[k] = cs.getPropertyValue(v).trim();
    this.#patterns.clear();
  }

  #measure(): void {
    const top = this.#canvas.getBoundingClientRect().top;
    for (const li of this.#root.querySelectorAll<HTMLElement>('.ui-track')) {
      const r = li.getBoundingClientRect();
      const track = TRACKS.find((t) => t === li.dataset['track']);
      if (track) this.#rows.set(track, [r.top - top, r.height]);
    }
    const dpr = window.devicePixelRatio || 1;
    this.#w = this.#canvas.clientWidth;
    this.#h = this.#canvas.clientHeight;
    this.#window = this.#w < 500 ? 2000 : 4000;
    this.#canvas.width = Math.round(this.#w * dpr);
    this.#canvas.height = Math.round(this.#h * dpr);
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  #enable(): void {
    const ready = this.#channel.reporting;
    for (const b of this.#root.querySelectorAll<HTMLButtonElement>('button[data-act]')) {
      const act = b.dataset['act'];
      const needs = act === 'block-c' ? 'C' : act === 'crash-a' ? 'A' : null;
      // A failed isolate's control is its Restart button.
      const down = TARGETS[act ?? '']?.some((id) => this.#down.has(id)) ?? false;
      if (b.dataset['hold'] === undefined && (down || needs === null || ready.has(needs)))
        b.disabled = false;
    }
  }

  #hold(button: HTMLButtonElement, ms: number): void {
    button.disabled = true;
    button.dataset['hold'] = '';
    setTimeout(() => {
      delete button.dataset['hold'];
      this.#enable();
    }, ms);
  }

  /**
   * Each control's label: its restarts used this minute (`Crash A · 2/3`), or
   * Restart once its isolate has failed. The count is in the accessible name;
   * changes are announced through the status line, not on every tick.
   */
  #label(): void {
    for (const b of this.#root.querySelectorAll<HTMLButtonElement>('button[data-act]')) {
      const ids = TARGETS[b.dataset['act'] ?? ''];
      if (!ids) continue;
      const base = b.dataset['base'] ?? '';
      const down = ids.filter((id) => this.#down.has(id));
      if (down.length > 0) {
        b.dataset['mode'] = 'restart';
        b.textContent = copy.controls.restart(down);
        b.removeAttribute('aria-label');
        continue;
      }
      delete b.dataset['mode'];
      const used = Math.max(...ids.map((id) => this.#used.get(id) ?? 0));
      b.textContent = copy.controls.used(base, used);
      b.setAttribute('aria-label', copy.controls.usedName(base, used));
    }
  }

  #act(button: HTMLButtonElement): void {
    const act = button.dataset['act'];
    if (button.dataset['mode'] === 'restart') {
      for (const id of TARGETS[act ?? ''] ?? []) {
        if (this.#down.has(id)) this.#channel.send('restart', id);
      }
      this.#hold(button, 1500);
      return;
    }
    if (act === 'block-c') {
      this.#channel.send('block-c');
      this.#hold(button, 4500);
    } else if (act === 'crash-a') {
      this.#channel.send('crash-a');
      this.#hold(button, 1500);
    } else if (act === 'block-main') {
      // Say it first and let it paint: once the command lands, this page can't.
      this.#say(copy.status.mainStuck);
      this.#hold(button, 4000);
      this.#blockMainAt = performance.now();
      requestAnimationFrame(() => setTimeout(() => this.#channel.send('block-main'), 50));
    }
  }

  #receive(m: Message): void {
    const id = str(m, 'id');
    switch (m.type) {
      case 'ready':
        this.#say(copy.status.running);
        break;
      case 'activity': {
        const place = id ? PLACE[id] : undefined;
        const ms = num(m, 'ms') ?? 0;
        const kind = str(m, 'kind');
        if (kind === 'rejected') {
          // The publish reached the bus and failed its schema: a red bus tick.
          this.#tick('bus', m.t, 'rejected');
        } else if (place) {
          const reaction = kind === 'read';
          this.#bars.push({
            track: place[0],
            row: place[1],
            start: m.t - ms,
            end: m.t,
            kind: reaction ? 'reaction' : 'task',
          });
          const topic = str(m, 'topic');
          const offset = num(m, 'offset');
          if (reaction && topic !== undefined && offset !== undefined)
            this.#link(`${topic}:${offset}`, place, m.t - ms);
        }
        this.#enable();
        break;
      }
      case 'record': {
        this.#tick('bus', m.t);
        const topic = str(m, 'topic');
        const offset = num(m, 'offset');
        const producer = str(m, 'producer');
        if (topic !== undefined && offset !== undefined && producer !== undefined) {
          const key = `${topic}:${offset}`;
          this.#records.set(key, { producer, t: m.t });
          const waiting = this.#pending.get(key);
          if (waiting) {
            this.#pending.delete(key);
            this.#link(key, waiting.to, waiting.t1);
          }
        }
        break;
      }
      case 'state': {
        const place = id ? PLACE[id] : undefined;
        if (!id || !place) break;
        const state = str(m, 'state');
        if (id === 'A' && state !== undefined) {
          if (DOWN.has(state)) this.#upDown ??= m.t;
          else this.#upDown = undefined;
          this.#markWaiting();
        }
        if (state === 'blocked' && !this.#open.has(id)) {
          const sharedWithC = id === 'D' && this.#open.has('C');
          const bar: Bar = {
            track: place[0],
            row: place[1],
            start: m.t,
            end: m.t,
            kind: sharedWithC || id === 'C' ? (id === 'C' ? 'stuck' : 'stalled') : 'stuck',
            label:
              id === 'C' ? 'C is stuck' : sharedWithC ? 'D waits: same loop' : `${id} is stuck`,
          };
          this.#open.set(id, bar);
          this.#bars.push(bar);
          if (id === 'C') this.#say(copy.status.cStuck);
        } else if (state !== 'blocked') {
          const bar = this.#open.get(id);
          if (bar) {
            bar.end = m.t;
            this.#open.delete(id);
          }
        }
        // Restarted by hand after the crash-loop guard: the red span ends.
        if (str(m, 'prev') === 'failed' && state !== 'failed') {
          const down = this.#down.get(id);
          if (down) {
            down.end = m.t;
            this.#down.delete(id);
            this.#marks.push({ t: m.t, track: place[0], text: `${id} restarted by hand` });
            this.#say(copy.status.restarted(id));
            this.#label();
            this.#enable();
          }
        }
        break;
      }
      case 'failed': {
        const place = id ? PLACE[id] : undefined;
        if (!id || !place || this.#down.has(id)) break;
        // The crash just before it was the last one: no restart follows.
        const last = this.#marks.findLast((k) => k.track === place[0] && m.t - k.t < 500);
        if (last) last.text = last.text.replace(', restarted', '');
        const open = this.#open.get(id);
        if (open) {
          open.end = m.t;
          this.#open.delete(id);
        }
        if (id === 'A') {
          this.#upDown ??= m.t;
          this.#markWaiting();
        }
        const bar: Bar = {
          track: place[0],
          row: place[1],
          start: m.t,
          end: m.t,
          kind: 'failed',
          label: `${id} failed: crash-loop guard`,
        };
        this.#down.set(id, bar);
        this.#bars.push(bar);
        this.#say(copy.status.failed(id));
        this.#crashSaid = undefined;
        this.#label();
        this.#enable();
        break;
      }
      case 'crash': {
        const place = id ? PLACE[id] : undefined;
        if (!id || !place) break;
        const pool = str(m, 'pool');
        const recent = this.#marks.some((k) => k.track === place[0] && m.t - k.t < 500);
        if (pool && !recent) {
          this.#marks.push({ t: m.t, track: place[0], text: 'pool stopped and started again' });
          if (str(m, 'reason') === 'unresponsive') {
            this.#say(copy.status.poolRestarted);
            this.#crashSaid = { ids: ['C', 'D'], text: copy.status.poolRestarted };
          }
        } else if (!pool) {
          this.#marks.push({ t: m.t, track: place[0], text: `${id} crashed, restarted` });
          if (id === 'A') {
            this.#say(copy.status.aCrashed);
            this.#crashSaid = { ids: ['A'], text: copy.status.aCrashed };
          }
        }
        break;
      }
      case 'budget': {
        const used = num(m, 'used');
        if (!id || used === undefined) break;
        this.#used.set(id, used);
        this.#label();
        // Announced once, after the crash that used it; not when it counts down.
        const said = this.#crashSaid;
        if (str(m, 'cause') === 'crash' && said?.ids.includes(id) && !this.#down.has(id)) {
          this.#say(`${said.text} ${copy.status.budget(used)}`);
          this.#crashSaid = undefined;
        }
        break;
      }
      default:
        break;
    }
  }

  #tick(track: Track, t: number, kind: Kind = 'task'): void {
    this.#bars.push({ track, row: 0, start: t, end: t + 1.5, kind });
    if (track === 'bus') {
      this.#counts.bus++;
      this.#root.dataset['busTicks'] = String(this.#counts.bus);
    }
  }

  /** For the smoke test: whether C's and D's rows say they wait for A. */
  #markWaiting(): void {
    if (this.#upDown === undefined) delete this.#root.dataset['waiting'];
    else this.#root.dataset['waiting'] = 'A';
  }

  /** Links a reaction to the record it read, once that record has been seen. */
  #link(key: string, to: [Track, number], t1: number): void {
    const rec = this.#records.get(key);
    const from = rec ? PLACE[rec.producer] : undefined;
    if (!rec || !from) {
      if (!rec) this.#pending.set(key, { to, t1 });
      return;
    }
    this.#links.push({ from, t0: rec.t, to, t1 });
    this.#counts.links++;
    this.#root.dataset['links'] = String(this.#counts.links);
  }

  /** The vertical middle of a track's row (the pool has two). */
  #mid(track: Track, row: number): number | undefined {
    const r = this.#rows.get(track);
    if (!r) return undefined;
    return track === 'pool' ? r[0] + (row + 0.5) * (r[1] / 2) : r[0] + r[1] / 2;
  }

  #loop(): void {
    if (this.#running || reducedMotion()) {
      this.#draw();
      return;
    }
    this.#running = true;
    const frame = (): void => {
      if (!this.#visible) {
        this.#running = false;
        return;
      }
      this.#draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** Counts this page's frames while the recording is in view. */
  #count(): void {
    if (this.#counting) return;
    this.#counting = true;
    const frame = (now: number): void => {
      if (!this.#visible || document.hidden) {
        this.#counting = false;
        this.#lastFrame = undefined;
        return;
      }
      this.#frame(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** A frame at `t`: a tick, and a stuck span if the gap before it was too long. */
  #frame(t: number): void {
    if (this.#lastFrame !== undefined && t - this.#lastFrame > MAIN_STUCK_MS) {
      this.#bars.push({
        track: 'main',
        row: 0,
        start: this.#lastFrame,
        end: t,
        kind: 'stuck',
        label: 'Main thread stuck: nothing could paint',
      });
      this.#counts.stuck++;
      this.#root.dataset['stuck'] = String(this.#counts.stuck);
      if (this.#blockMainAt !== undefined && t > this.#blockMainAt) {
        this.#blockMainAt = undefined;
        this.#say(copy.status.mainFree);
      }
    }
    this.#lastFrame = t;
    this.#bars.push({ track: 'main', row: 0, start: t, end: t + 2, kind: 'task' });
  }

  #hatch(color: string, dense: boolean): CanvasPattern | null {
    const key = color + String(dense);
    if (this.#patterns.has(key)) return this.#patterns.get(key) ?? null;
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    c.width = c.height = 8 * dpr;
    const x = c.getContext('2d');
    if (!x) return null;
    x.scale(dpr, dpr);
    x.strokeStyle = color;
    x.lineWidth = dense ? 2.2 : 1.4;
    x.globalAlpha = dense ? 1 : 0.7;
    x.beginPath();
    x.moveTo(-2, 10);
    x.lineTo(10, -2);
    x.moveTo(-2, 2);
    x.lineTo(2, -2);
    x.moveTo(6, 10);
    x.lineTo(10, 6);
    x.stroke();
    const p = this.#ctx.createPattern(c, 'repeat');
    this.#patterns.set(key, p);
    return p;
  }

  #draw(): void {
    const now = performance.now();
    const { w: W, h: H } = { w: this.#w, h: this.#h };
    const ctx = this.#ctx;
    const colors = this.#colors;
    const px = W / this.#window;
    const x = (t: number): number => W - (now - t) * px;
    // Open spans grow until the kernel says otherwise.
    for (const bar of this.#open.values()) bar.end = now;
    for (const bar of this.#down.values()) bar.end = now;
    this.#bars = this.#bars.filter((b) => b.end > now - this.#window - 200);
    // A failed span stays on screen, clipped to the window, until restarted.
    for (const bar of this.#down.values())
      bar.start = Math.max(bar.start, now - this.#window - 100);
    this.#marks = this.#marks.filter((m) => m.t > now - this.#window - 200);
    this.#links = this.#links.filter((l) => l.t1 > now - this.#window - 200);
    for (const [k, r] of this.#records)
      if (r.t < now - this.#window - 2000) this.#records.delete(k);
    for (const [k, p] of this.#pending) if (p.t1 < now - this.#window) this.#pending.delete(k);
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = colors['rule'] ?? '#ccc';
    ctx.lineWidth = 1;
    for (const [, [top, h]] of this.#rows) {
      ctx.beginPath();
      ctx.moveTo(0, top + h - 0.5);
      ctx.lineTo(W, top + h - 0.5);
      ctx.stroke();
    }
    const pool = this.#rows.get('pool');
    if (pool) {
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, pool[0] + pool[1] / 2);
      ctx.lineTo(W, pool[0] + pool[1] / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 11px Archivo, system-ui';
      ctx.fillStyle = colors['muted'] ?? '#555';
      // The row names sit in a strip of their own, left of where bars start.
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 8, pool[0] + pool[1] / 4);
      ctx.fillText('D', 8, pool[0] + (3 * pool[1]) / 4);
      ctx.textBaseline = 'alphabetic';
    }

    for (const b of this.#bars) {
      const r = this.#rows.get(b.track);
      if (!r) continue;
      const split = b.track === 'pool';
      const sub = split ? r[1] / 2 : r[1];
      const y = r[0] + (split ? b.row * sub : 0) + 9;
      const h = sub - 18;
      // In the pool's two rows, bars stop short of the strip with C and D.
      const left = split ? POOL_LABELS : 0;
      const x0 = Math.max(x(b.start), left);
      const x1 = Math.min(x(b.end), W);
      if (x1 < left) continue;
      const width = Math.max(b.track === 'main' || b.track === 'bus' ? 1.2 : 2.5, x1 - x0);
      const bad = b.kind === 'failed' || b.kind === 'rejected';
      const c = (bad ? colors['bad'] : colors[b.track]) ?? '#888';
      if (b.kind === 'task' || b.kind === 'rejected') {
        ctx.fillStyle = c;
        ctx.fillRect(x0, y, b.kind === 'rejected' ? 2.5 : width, h);
        continue;
      }
      if (b.kind === 'reaction') {
        // Hollow and lighter: work caused by another isolate's record.
        const rw = Math.max(5, width);
        const ry = y + h * 0.18;
        const rh = h * 0.64;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = c;
        ctx.fillRect(x0, ry, rw, rh);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.25;
        ctx.strokeRect(x0 + 0.5, ry + 0.5, rw - 1, rh - 1);
        continue;
      }
      const pattern = this.#hatch(c, b.kind !== 'stalled');
      if (pattern) ctx.fillStyle = pattern;
      ctx.fillRect(x0, y, width, h);
      ctx.strokeStyle = c;
      ctx.lineWidth = b.kind === 'stalled' ? 1 : 2;
      ctx.strokeRect(x0 + 0.5, y + 0.5, width - 1, h - 1);
      if (b.label && width > 120) {
        ctx.font = '650 12px Archivo, system-ui';
        const tx = Math.max(x0 + 8, 8);
        const tw = ctx.measureText(b.label).width;
        ctx.fillStyle = colors['panel'] ?? '#fff';
        ctx.fillRect(tx - 4, y + h / 2 - 9, tw + 8, 18);
        ctx.fillStyle = colors['ink'] ?? '#000';
        ctx.fillText(b.label, tx, y + h / 2 + 4);
      }
    }

    // Each reaction's link back to who published the record it read.
    ctx.strokeStyle = colors['muted'] ?? '#666';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (const l of this.#links) {
      const y0 = this.#mid(l.from[0], l.from[1]);
      const y1 = this.#mid(l.to[0], l.to[1]);
      if (y0 === undefined || y1 === undefined) continue;
      const x0 = x(l.t0);
      const x1 = x(l.t1);
      if (Math.max(x0, x1) < 0) continue;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // While A is down: C and D aren't stuck, they have no count to read.
    if (this.#upDown !== undefined && pool) {
      ctx.font = 'italic 500 11.5px Archivo, system-ui';
      const text = copy.waiting;
      const tw = ctx.measureText(text).width;
      for (const row of [0, 1]) {
        const ym = this.#mid('pool', row);
        if (ym === undefined) continue;
        const tx = Math.min(Math.max(x(this.#upDown) + 8, 24), W - tw - 10);
        ctx.fillStyle = colors['panel'] ?? '#fff';
        ctx.fillRect(tx - 4, ym - 8, tw + 8, 16);
        ctx.fillStyle = colors['muted'] ?? '#555';
        ctx.fillText(text, tx, ym + 4);
      }
    }

    for (const m of this.#marks) {
      const r = this.#rows.get(m.track);
      const mx = Math.round(x(m.t)) + 0.5;
      if (!r || mx < 0) continue;
      ctx.strokeStyle = colors['ink'] ?? '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, r[0] + 3);
      ctx.lineTo(mx, r[0] + r[1] - 3);
      ctx.stroke();
      ctx.font = '650 12px Archivo, system-ui';
      const tw = ctx.measureText(m.text).width;
      let tx = mx + 6;
      if (tx + tw > W - 4) tx = mx - tw - 6;
      ctx.fillStyle = colors['panel'] ?? '#fff';
      ctx.fillRect(tx - 3, r[0] + 4, tw + 6, 16);
      ctx.fillStyle = colors['ink'] ?? '#000';
      ctx.fillText(m.text, tx, r[0] + 16);
    }

    const ry = H - 28;
    ctx.fillStyle = colors['muted'] ?? '#555';
    ctx.font = '500 11.5px Archivo, system-ui';
    for (let s = 0; s <= this.#window / 1000; s++) {
      const tx = W - s * 1000 * px;
      ctx.fillRect(tx - 0.5, ry, 1, 6);
      const label = s === 0 ? 'now' : `${s} s ago`;
      const lw = ctx.measureText(label).width;
      ctx.fillText(label, Math.min(Math.max(tx - lw / 2, 4), W - lw - 4), ry + 20);
    }
  }
}
