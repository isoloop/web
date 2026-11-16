// The merged topics behind the catalog's per-machine entries (catalog.ts):
// each machine's slow signals, health, spectrum summary and raw vibration, also published to
// one topic keyed by machine. On the Isoloop page the feed and engines tee
// what they publish (isolates/); on the native page the sources read the
// store's per-machine streams instead (native.ts). No Zod.
import type { MachineId } from '../core/machines';
import type { Spectrum } from '../core/schemas';
import type { Source, StreamName } from '../core/streams';
import { MERGED } from './catalog';

/** The record of a merged topic, from a machine stream's record; undefined if the stream isn't merged. */
export function mergedOf(
  stream: StreamName,
  value: unknown,
): { topic: string; key: MachineId; value: unknown } | undefined {
  const [m, k] = stream.split('.');
  if (m === undefined || k === undefined) return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a machine stream's prefix
  const key = m as MachineId;
  if (k === 'scalars') return { topic: MERGED.scalars, key, value };
  if (k === 'health') return { topic: MERGED.health, key, value };
  if (k === 'vib') return { topic: MERGED.vib, key, value };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a `spectrum` stream's record
  if (k === 'spectrum') return { topic: MERGED.spectrum, key, value: summary(value as Spectrum) };
  return undefined;
}

/** A spectrum without its bins: what the catalog offers. */
export function summary(s: Spectrum): {
  machine: MachineId;
  ts: number;
  binHz: number;
  peakHz: number;
  peak: number;
  rms: number;
} {
  return {
    machine: s.machine,
    ts: s.ts,
    binHz: s.binHz,
    peakHz: s.peakHz,
    peak: s.peak,
    rms: s.rms,
  };
}

/** `src`, also publishing each merged stream's records to its merged topic. */
export function teeSource(
  src: Source,
  publish: (topic: string, key: string, value: unknown) => void,
): Source {
  return {
    subscribe: (stream, fn, from) => src.subscribe(stream, fn, from),
    publish: (stream, value, key) => {
      src.publish(stream, value, key);
      const m = mergedOf(stream, value);
      if (m) publish(m.topic, m.key, m.value);
    },
  };
}
