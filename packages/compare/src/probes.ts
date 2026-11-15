// The comparison specs' readings from outside the page: main-thread metrics,
// CPU time per process, renderer memory (PSS from /proc) and a forced GC in
// the page and every worker. CPU and memory are Chromium only (CDP), and
// memory is Linux only.
import { existsSync, readFileSync } from 'node:fs';
import type { Browser, CDPSession } from '@playwright/test';

export type PageMetrics = Record<string, number>;

/** CDP `Performance.getMetrics` for the page's main thread, by name. */
export async function pageMetrics(cdp: CDPSession): Promise<PageMetrics> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

export type Proc = { type: string; id: number; cpuTime: number };

/** Every browser process with its CPU time so far (CDP `SystemInfo.getProcessInfo`). */
export async function processes(browser: Browser): Promise<Proc[]> {
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { processInfo }: { processInfo: Proc[] } = await cdp.send('SystemInfo.getProcessInfo');
    return processInfo;
  } finally {
    await cdp.detach();
  }
}

/** CPU time per process id, for one process type (`renderer`, `gpu`…). */
export const cpuOf = (ps: Proc[], type: string): Map<number, number> =>
  new Map(ps.filter((p) => p.type === type).map((p) => [p.id, p.cpuTime]));

/** CPU seconds a process type used between two readings. */
export function cpuDelta(before: Proc[], after: Proc[], type: string): number {
  const b = cpuOf(before, type);
  let s = 0;
  for (const [id, t] of cpuOf(after, type)) s += t - (b.get(id) ?? t);
  return s;
}

/** The processes' summed PSS in MB, or null where /proc can't be read. */
export function pssMb(pids: number[]): number | null {
  let kb = 0;
  for (const pid of pids) {
    const f = `/proc/${pid}/smaps_rollup`;
    if (!existsSync(f)) return null;
    const m = /^Pss:\s+(\d+) kB/m.exec(readFileSync(f, 'utf8'));
    kb += Number(m?.[1] ?? 0);
  }
  return Math.round(kb / 1024);
}

/**
 * Forces a GC in the page and in every worker, twice (a worker's first
 * collection can leave garbage the second frees), over non-flattened target
 * sessions, as the plant memory investigation's probes do.
 */
export async function gcAll(browser: Browser): Promise<void> {
  const b = await browser.newBrowserCDPSession();
  const pending = new Map<number, () => void>();
  let next = 1;
  b.on('Target.receivedMessageFromTarget', (e: { message: string }) => {
    const m: unknown = JSON.parse(e.message);
    const id: unknown = typeof m === 'object' && m !== null ? Reflect.get(m, 'id') : undefined;
    if (typeof id !== 'number') return;
    pending.get(id)?.();
    pending.delete(id);
  });
  try {
    for (let round = 0; round < 2; round++) {
      // oxlint-disable-next-line no-await-in-loop -- rounds in order
      const { targetInfos } = (await b.send('Target.getTargets')) as {
        targetInfos: { targetId: string; type: string }[];
      };
      for (const t of targetInfos.filter((x) => x.type === 'worker' || x.type === 'page')) {
        // oxlint-disable-next-line no-await-in-loop -- one target at a time
        const { sessionId } = await b.send('Target.attachToTarget', {
          targetId: t.targetId,
          flatten: false,
        });
        const id = next++;
        const done = new Promise<void>((resolve) => pending.set(id, resolve));
        // oxlint-disable-next-line no-await-in-loop -- one target at a time
        await b.send('Target.sendMessageToTarget', {
          sessionId,
          message: JSON.stringify({ id, method: 'HeapProfiler.collectGarbage', params: {} }),
        });
        // oxlint-disable-next-line no-await-in-loop -- one target at a time
        await Promise.race([done, new Promise((r) => setTimeout(r, 5_000))]);
        // oxlint-disable-next-line no-await-in-loop -- one target at a time
        await b.send('Target.detachFromTarget', { sessionId }).catch(() => {});
      }
    }
  } finally {
    await b.detach();
  }
}

/** Renderer PSS now and after a forced GC, MB (Chromium on Linux). */
export async function memory(
  browser: Browser,
): Promise<{ pss: number | null; pssGc: number | null }> {
  const pids = (): Promise<number[]> =>
    processes(browser).then((ps) => [...cpuOf(ps, 'renderer').keys()]);
  const pss = pssMb(await pids());
  await gcAll(browser);
  await new Promise((r) => setTimeout(r, 1_000));
  return { pss, pssGc: pssMb(await pids()) };
}
