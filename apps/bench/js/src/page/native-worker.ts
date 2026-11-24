// The plain-Worker baseline: the same harness, with postMessage instead of a bus.
import { prepare, runFor, type BenchWindow, type Prepared } from '../harness.ts';

let prepared: Prepared | undefined;
let batch = 1;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as
    | { kind: 'prepare'; workload: string; seed: number; batch: number }
    | { kind: 'run'; window: BenchWindow };
  if (msg.kind === 'prepare') {
    prepared = prepare(msg.workload, msg.seed);
    batch = msg.batch;
    postMessage({ kind: 'ready', checksum: prepared.checksum });
  } else if (prepared) {
    const result = await runFor({ prepared, batch, window: msg.window });
    postMessage({ kind: 'result', result });
  }
};
