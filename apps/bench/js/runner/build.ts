import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');

/** Builds dist/ once per command, so every run serves the same build. */
export function ensureBuilt(): void {
  execSync('pnpm -s build', { cwd: ROOT, stdio: 'inherit' });
}
