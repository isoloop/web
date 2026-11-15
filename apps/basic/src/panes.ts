// The page around the isolates: one pane per isolate with its name, where it
// runs, its loop's state and its restarts, painted from kernel.isolates().
import type { IsolateSnapshot, Kernel } from '@isoloop/host';

/** What a failed pane says: the kernel's restart limit (3 within 60 s by default). */
export const GUARD =
  'Stopped after 3 restarts within a minute: the kernel’s crash-loop guard. Restart it to try again.';

export type Pane = { id: string; body: HTMLElement; paint(s: IsolateSnapshot | undefined): void };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}

export function createPane(
  parent: HTMLElement,
  spec: { id: string; name: string; where: string },
  kernel: Kernel,
): Pane {
  const pane = el('section', 'pane');
  pane.dataset['isolate'] = spec.id;
  pane.setAttribute('aria-label', spec.name);
  const head = el('div', 'pane-head');
  const status = el('span', 'status', 'starting');
  const restarts = el('span', 'restarts');
  const restart = el('button', 'ui-button small', `Restart ${spec.id}`);
  restart.dataset['restart'] = spec.id;
  // Shown when the kernel's crash-loop guard has stopped restarting it.
  const guard = el('p', 'guard', GUARD);
  guard.hidden = true;
  restart.addEventListener('click', () => {
    void kernel.restart(spec.id);
  });
  head.append(el('h3', 'pane-name', spec.name), el('span', 'where', spec.where), status, restarts);
  const body = el('div', 'pane-body');
  const foot = el('div', 'pane-foot');
  foot.append(guard, restart);
  pane.append(head, body, foot);
  parent.append(pane);

  return {
    id: spec.id,
    body,
    paint(s) {
      if (!s) return;
      restarts.textContent = `restarts: ${s.restarts}`;
      // Between a crash and the respawn, the supervisor is `restarting` with the error kept.
      const crashed = s.state === 'crashed' || (s.state === 'restarting' && s.error !== undefined);
      pane.dataset['state'] = crashed ? 'crashed' : s.state;
      if (crashed) status.textContent = 'crashed, restarting';
      else if (s.state === 'blocked')
        status.textContent = `blocked ${((performance.now() - s.lastBeatAt) / 1000).toFixed(1)} s`;
      else if (s.state === 'running')
        status.textContent = `loop ok · lag ${Math.round(s.lagMs)} ms`;
      else if (s.state === 'failed') status.textContent = 'failed: stopped restarting';
      else status.textContent = 'starting';
      guard.hidden = s.state !== 'failed';
      if (s.state === 'failed') restart.dataset['strong'] = '';
      else delete restart.dataset['strong'];
    },
  };
}

/** Main-thread frames per second, in a chip that freezes when the main thread does. */
export function startFps(chip: HTMLElement): void {
  let frames = 0;
  let mark = performance.now();
  const loop = (now: number): void => {
    frames++;
    if (now - mark >= 500) {
      chip.textContent = `main thread: ${Math.round((frames * 1000) / (now - mark))} fps`;
      frames = 0;
      mark = now;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function blockMain(ms: number): void {
  const t = performance.now();
  while (performance.now() - t < ms) {
    // Blocks the main thread on purpose: every pane freezes on screen.
  }
}
