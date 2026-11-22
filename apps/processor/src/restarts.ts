// The kernel's restart limit, from `?restarts=` (the page's Restarts control).
// The supervisor is configured kernel-wide in createKernel, so a new limit
// takes a new kernel: the control reloads the page with the parameter, and it
// applies to every isolate from the start. Without the parameter the kernel
// gets no supervisor config at all and keeps the host's defaults (3 restarts
// within 60 s), exactly as before: the comparison never passes it.

/** The kernel's defaults (the host's supervision guide). */
export const DEFAULT_LIMIT = 3;
export const WINDOW_MS = 60_000;

/** The control's steps: `0` fails on the first crash (strategy `never`). */
export const RESTART_STEPS = ['0', '1', '3', '10'] as const;
export type RestartStep = (typeof RESTART_STEPS)[number];

export type Restarts = {
  step: RestartStep;
  /** Restarts allowed within the window. */
  limit: number;
  /** For createKernel: undefined keeps the host's defaults. */
  supervisor: { strategy: 'never' } | { maxRestarts: number } | undefined;
};

/** Whether a value is one of the control's steps. */
export const isRestartStep = (v: string | null): v is RestartStep =>
  (RESTART_STEPS as readonly (string | null)[]).includes(v);

export function restartsFrom(search: string): Restarts {
  const raw = new URLSearchParams(search).get('restarts');
  const step: RestartStep = isRestartStep(raw) ? raw : '3';
  if (raw === null || step === '3')
    return { step: '3', limit: DEFAULT_LIMIT, supervisor: undefined };
  if (step === '0') return { step, limit: 0, supervisor: { strategy: 'never' } };
  return { step, limit: Number(step), supervisor: { maxRestarts: Number(step) } };
}

/** The gave-up line on a card and in the log, in the kernel's terms. */
export function gaveUpText(limit: number, reason: string): string {
  if (limit === 0) return `stopped: crashed (${reason}), restarts off`;
  const crashes = limit + 1;
  return `stopped: ${crashes} crashes in ${WINDOW_MS / 1000} s, limit ${limit} (${reason})`;
}

/** The page's URL with `?restarts=` set, or removed for the default. */
export function withRestarts(href: string, step: RestartStep): string {
  const url = new URL(href);
  if (step === '3') url.searchParams.delete('restarts');
  else url.searchParams.set('restarts', step);
  return url.href;
}
