// What the machine and the build were, for run.json. The machine is named by
// its id (apps/bench/machines.md), from JSBENCH_MACHINE, which server-run.sh
// sets: `bench-machine-1`. No hostname goes into the results.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string): string | null => {
  try {
    return readFileSync(p, 'utf8').trim();
  } catch {
    return null;
  }
};
const sh = (cmd: string): string | null => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

/** The machine's id: `bench-machine-1` on bench machine 1, `local` anywhere else. */
export const machineId = (): string => process.env.JSBENCH_MACHINE ?? 'local';

/** A package.json's version, or null. */
function versionOf(json: string | null): string | null {
  const pkg: unknown = JSON.parse(json ?? '{}');
  return typeof pkg === 'object' &&
    pkg !== null &&
    'version' in pkg &&
    typeof pkg.version === 'string'
    ? pkg.version
    : null;
}

export function environment(root: string) {
  const cpuinfo = read('/proc/cpuinfo') ?? '';
  const mhz = [...cpuinfo.matchAll(/^cpu MHz\s*:\s*([\d.]+)/gm)].map((m) => Number(m[1]));
  const isoloop = Object.fromEntries(
    ['host', 'runtime', 'bus', 'balancer', 'vite'].map((p) => [
      `@isoloop/${p}`,
      versionOf(read(resolve(root, `node_modules/@isoloop/${p}/package.json`))),
    ]),
  );
  return {
    machine: machineId(),
    date: new Date().toISOString(),
    git: sh(`git -C ${root} rev-parse --short HEAD`),
    gitDirty: (sh(`git -C ${root} status --porcelain -- .`) ?? '') !== '',
    isoloop,
    node: process.version,
    cpu: /^model name\s*:\s*(.+)$/m.exec(cpuinfo)?.[1] ?? null,
    logicalCpus: mhz.length,
    mhz: mhz.length ? { min: Math.min(...mhz), max: Math.max(...mhz) } : null,
    cpusetEffective: read('/sys/fs/cgroup/cpuset.cpus.effective'),
    cpuMax: read('/sys/fs/cgroup/cpu.max'),
    kernel: sh('uname -r'),
  };
}
