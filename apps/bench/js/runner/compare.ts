// pnpm compare <before dir> <after dir> [--threshold 3] [--allow-machine-change]: what changed
// between two runs (usually two Isoloop releases), in plain English, as
// operations per second. Writes <after>/compare-<before version>.md.
//
// A change counts only when it's bigger than the noise: the threshold (3 %
// by default) or the spread of either run's rounds, whichever is larger.
// The native rows are the control. When they moved too, the machine or the
// browser changed, not Isoloop, so each Isoloop row is also compared as a
// share of the plain Worker's rate, which cancels that out. Runs from two
// machines aren't compared unless --allow-machine-change is given.
import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { machineMismatch, machineOf } from './machine.ts';
import { readJson } from './read.ts';
import { load, median, type RunFile } from './summary.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    threshold: { type: 'string', default: '3' },
    'allow-machine-change': { type: 'boolean', default: false },
  },
});
const [beforeDir, afterDir] = positionals.map((p) => resolve(p));
if (!beforeDir || !afterDir)
  throw new Error('usage: pnpm compare <before results dir> <after results dir>');
const threshold = Number(values.threshold) / 100;

interface Cell {
  med: number;
  spread: number; // (max − min) / median, over rounds
  rounds: number;
}

function cells(runs: RunFile[]): Map<string, Cell> {
  const by = new Map<string, number[]>();
  for (const r of runs) {
    if (r.state !== 'done' || !r.result) continue;
    const k = `${r.engine}|${r.job.key}|${r.job.placement}`;
    (by.get(k) ?? by.set(k, []).get(k)!).push(r.result.totalOpsPerMin / 60);
  }
  const out = new Map<string, Cell>();
  for (const [k, xs] of by) {
    const med = median(xs)!;
    out.set(k, {
      med,
      spread: med ? (Math.max(...xs) - Math.min(...xs)) / med : 0,
      rounds: xs.length,
    });
  }
  return out;
}

const env = (dir: string) =>
  readJson<{
    env: {
      machine?: string;
      isoloop: Record<string, string>;
      cpu: string;
      mhz: { max: number } | null;
      cpusetEffective: string | null;
      cpuMax: string | null;
      git: string;
    };
    calibration: { workloads: { id: string; batch: number }[] };
    args: { profile: string };
  }>(resolve(dir, 'run.json'));
const A = env(beforeDir);
const B = env(afterDir);
const mismatch = machineMismatch(machineOf(A), machineOf(B), values['allow-machine-change']);
if (mismatch) {
  console.error(mismatch);
  process.exit(1);
}
const va = A.env.isoloop['@isoloop/host'];
const vb = B.env.isoloop['@isoloop/host'];
const ra = load(beforeDir);
const rb = load(afterDir);
const ca = cells(ra);
const cb = cells(rb);

const num = (x: number): string => (x >= 100 ? Math.round(x).toLocaleString('en') : x.toFixed(1));
const pct = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)} %`;
const NAMES: Record<string, string> = {
  'native-main': 'main thread',
  'native-worker': 'plain Workers',
  'isoloop-own': 'Isoloop, a worker each',
  'isoloop-one': 'Isoloop, one shared worker',
  'isoloop-balancer': 'Isoloop balancer',
};
const label = (key: string): string => {
  const m = /^(.*)-n(\d+)$/.exec(key);
  return m ? `${m[1]}, ${m[2]} cop${m[2] === '1' ? 'y' : 'ies'}` : key;
};

// Notes on what differs besides Isoloop.
const notes: string[] = [];
if (machineOf(A) !== machineOf(B))
  notes.push(
    `Different machines, compared with --allow-machine-change: ${machineOf(A) ?? 'unnamed'} before, ${machineOf(B) ?? 'unnamed'} after.`,
  );
const browsers = (rs: RunFile[]) =>
  [...new Set(rs.map((r) => `${r.engine} ${r.browserVersion}`))].join(', ');
if (browsers(ra) !== browsers(rb))
  notes.push(
    `The browser differs: ${browsers(ra)} before, ${browsers(rb)} after. Read the "share of plain Workers" column.`,
  );
if (
  A.env.cpu !== B.env.cpu ||
  A.env.cpusetEffective !== B.env.cpusetEffective ||
  A.env.cpuMax !== B.env.cpuMax
)
  notes.push(
    `The machine or its limits differ: ${A.env.cpu} (${A.env.cpusetEffective}, ${A.env.cpuMax}) before, ${B.env.cpu} (${B.env.cpusetEffective}, ${B.env.cpuMax}) after.`,
  );
const batchA = new Map(A.calibration.workloads.map((w) => [w.id, w.batch]));
const diffBatch = B.calibration.workloads
  .filter((w) => batchA.get(w.id) !== w.batch)
  .map((w) => w.id);
if (diffBatch.length)
  notes.push(
    `The batch sizes differ for ${diffBatch.join(', ')}: the calibration changed between runs.`,
  );
if (A.args.profile !== B.args.profile)
  notes.push(`Different CPU profiles: ${A.args.profile} before, ${B.args.profile} after.`);

interface Row {
  engine: string;
  key: string;
  placement: string;
  a: Cell;
  b: Cell;
  delta: number;
  noise: number;
  changed: boolean;
  shareA: number | null;
  shareB: number | null;
}
const rows: Row[] = [];
for (const [k, b] of cb) {
  const a = ca.get(k);
  if (!a) continue;
  const [engine = '', key = '', placement = ''] = k.split('|');
  const delta = (b.med - a.med) / a.med;
  const noise = Math.max(threshold, a.spread, b.spread);
  const wa = ca.get(`${engine}|${key}|native-worker`);
  const wb = cb.get(`${engine}|${key}|native-worker`);
  rows.push({
    engine,
    key,
    placement,
    a,
    b,
    delta,
    noise,
    changed: Math.abs(delta) > noise,
    shareA: wa && placement.startsWith('isoloop') ? a.med / wa.med : null,
    shareB: wb && placement.startsWith('isoloop') ? b.med / wb.med : null,
  });
}
rows.sort(
  (x, y) =>
    x.engine.localeCompare(y.engine) ||
    x.key.localeCompare(y.key) ||
    x.placement.localeCompare(y.placement),
);

const lines: string[] = [];
lines.push(`# Isoloop ${va} → ${vb}: what changed`, '');
lines.push(
  `Before: \`${basename(beforeDir)}\` (Isoloop ${va}, js-bench \`${A.env.git}\`). After: \`${basename(afterDir)}\` (Isoloop ${vb}, js-bench \`${B.env.git}\`). Figures are operations per second, the median over rounds. A change counts when it's bigger than ${Math.round(threshold * 100)} % or the spread between rounds, whichever is larger.`,
  '',
);
for (const n of notes) lines.push(`> ${n}`, '');

const iso = rows.filter((r) => r.placement.startsWith('isoloop'));
const nat = rows.filter((r) => r.placement.startsWith('native'));
const isoChanged = iso.filter((r) => r.changed);
const natChanged = nat.filter((r) => r.changed);
lines.push('## In short', '');
if (isoChanged.length === 0)
  lines.push(`- **No Isoloop figure changed** beyond the noise, in ${iso.length} compared.`);
else {
  const up = isoChanged.filter((r) => r.delta > 0).length;
  lines.push(
    `- **${isoChanged.length} of ${iso.length} Isoloop figures changed** beyond the noise: ${up} faster, ${isoChanged.length - up} slower.`,
  );
}
lines.push(
  natChanged.length === 0
    ? `- **The native figures held** (${nat.length} compared), so the machine and browser behaved the same.`
    : `- **${natChanged.length} of ${nat.length} native figures changed too.** Something besides Isoloop moved (machine, browser or noise), so trust the "share of plain Workers" column over the raw numbers where they overlap.`,
);
lines.push('');
if (isoChanged.length) {
  lines.push('## What changed', '');
  for (const r of isoChanged.toSorted((x, y) => Math.abs(y.delta) - Math.abs(x.delta))) {
    const share =
      r.shareA !== null && r.shareB !== null
        ? ` As a share of plain Workers: ${(r.shareA * 100).toFixed(0)} % → ${(r.shareB * 100).toFixed(0)} %.`
        : '';
    const control = nat.filter((n) => n.engine === r.engine && n.key === r.key && n.changed);
    const ctl = control.length ? ' The native rows for this workload moved too.' : '';
    lines.push(
      `- **${label(r.key)}, ${NAMES[r.placement]}:** ${num(r.a.med)} → ${num(r.b.med)} ops/s (${pct(r.delta)}, ${r.delta > 0 ? 'faster' : 'slower'}).${share}${ctl}`,
    );
  }
  lines.push('');
}
lines.push('## Every figure', '');
lines.push(
  `| workload | placement | ${va} ops/s | ${vb} ops/s | change | noise | share of plain Workers |`,
  '| --- | --- | ---: | ---: | ---: | ---: | --- |',
);
for (const r of rows) {
  const share =
    r.shareA !== null && r.shareB !== null
      ? `${(r.shareA * 100).toFixed(0)} % → ${(r.shareB * 100).toFixed(0)} %`
      : '';
  lines.push(
    `| ${label(r.key)} | ${NAMES[r.placement]} | ${num(r.a.med)} | ${num(r.b.med)} | ${r.changed ? `**${pct(r.delta)}**` : pct(r.delta)} | ±${(r.noise * 100).toFixed(1)} % | ${share} |`,
  );
}
const missing = [...ca.keys()].filter((k) => !cb.has(k));
if (missing.length)
  lines.push(
    '',
    `${missing.length} figure(s) are in the before run only: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}.`,
  );
const file = resolve(afterDir, `compare-${va}.md`);
writeFileSync(file, `${lines.join('\n')}\n`);
console.log(lines.slice(0, 12 + isoChanged.length).join('\n'));
console.log(`\nwrote ${file}`);
