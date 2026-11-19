// The development server the devtools dev smoke test starts for itself
// (devtools-dev.spec.ts, M4b task 11). It isn't in playwright.config.ts's
// webServer, so the measured comparison runs never have it running beside
// the page.
import { spawn, type ChildProcess } from 'node:child_process';

export const DEV_PORT = 4789;
export const DEV_URL = `http://localhost:${DEV_PORT}/`;

/** Starts `vite` on DEV_PORT and resolves once it answers; the caller stops it. */
export async function startDevServer(): Promise<ChildProcess> {
  const child = spawn('pnpm', ['dev', '--port', String(DEV_PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  const until = Date.now() + 120_000;
  for (;;) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- polling until the server answers
      if ((await fetch(DEV_URL)).ok) return child;
    } catch {
      // not up yet
    }
    if (Date.now() > until) {
      stopDevServer(child);
      throw new Error(`the dev server didn't answer on ${DEV_URL}`);
    }
    // oxlint-disable-next-line no-await-in-loop -- polling until the server answers
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Stops the dev server and the processes it started. */
export function stopDevServer(child: ChildProcess): void {
  if (child.pid !== undefined) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}
