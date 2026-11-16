// The interactive page's topics (M3e decision 3): the machines' streams its
// feeds and engines use, the merged topics the catalog offers (catalog.ts),
// the plant-wide ones, and the creator's three. Alarms and events are kept
// in memory here: plant's main page keeps them in OPFS, and the two pages
// share an origin, so the interactive page doesn't write to its history.
import { contracts, topic } from '@isoloop/bus';
import { creatorTopics } from 'creator/topics';
import { z } from 'zod';
import { MACHINES } from '../core/machines';
import { MACHINE_KEEP, PLANT_KEEP } from '../core/retention';
import * as s from '../core/schemas';
import { of, type MachineStream, type PlantStream } from '../core/streams';
import { retentionOf, topicName } from '../isoloop/names';
import { MERGED, SPECTRUM_KEEP_MS, VIB_KEEP_MS } from './catalog';

/** The machine streams this page runs: no stats engine, nothing reads it. */
export const STREAMS = ['vib', 'scalars', 'spectrum', 'health'] as const satisfies MachineStream[];

const at = (k: MachineStream) => ({ retention: retentionOf(MACHINE_KEEP[k]) });
const plant = (name: PlantStream) => ({ retention: retentionOf(PLANT_KEEP[name]) });

/** A spectrum without its bins (merged.ts). */
export const spectrumSummary = s.spectrum.omit({ mags: true });

const machineTopics = MACHINES.flatMap((m) => [
  topic(topicName(of(m, 'vib')), { schema: s.vibChunk, ...at('vib') }),
  topic(topicName(of(m, 'scalars')), { schema: s.scalars, ...at('scalars') }),
  topic(topicName(of(m, 'spectrum')), { schema: s.spectrum, ...at('spectrum') }),
  topic(topicName(of(m, 'health')), { schema: s.health, ...at('health') }),
]);

const mergedTopics = [
  topic(MERGED.scalars, { schema: s.scalars, ...at('scalars') }),
  topic(MERGED.health, { schema: s.health, ...at('health') }),
  topic(MERGED.spectrum, {
    schema: spectrumSummary,
    retention: { kind: 'time', ms: SPECTRUM_KEEP_MS },
  }),
  topic(MERGED.vib, { schema: s.vibChunk, retention: { kind: 'time', ms: VIB_KEEP_MS } }),
];

const plantTopics = [
  topic(topicName('alarms'), { schema: s.alarm, ...plant('alarms') }),
  topic(topicName('events'), { schema: s.event, ...plant('events') }),
  topic(topicName('fleet'), { schema: s.fleet, ...plant('fleet') }),
  topic(topicName('timings'), { schema: s.timings, ...plant('timings') }),
];

export default contracts(...machineTopics, ...mergedTopics, ...plantTopics, ...creatorTopics());

/** For the catalog test: the schema behind each topic the catalog offers. */
export const OFFERED: Record<string, z.ZodObject> = {
  [MERGED.scalars]: s.scalars,
  [MERGED.health]: s.health,
  [MERGED.spectrum]: spectrumSummary,
  [MERGED.vib]: s.vibChunk,
  'plant.fleet': s.fleet,
  'plant.alarms': s.alarm,
  'plant.events': s.event,
};
