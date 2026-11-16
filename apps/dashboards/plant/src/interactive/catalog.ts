// The plant topics the interactive page offers to the widgets users create
// (M3e decision 18), written by hand. No Zod: the page and the isolates both
// import it; catalog.test.ts checks it against the schemas and retention.
//
// The machines' slow signals, health and spectrum summaries come as one topic
// each, keyed by machine (merged.ts), so a widget can pick one machine
// (`source.key`) or group by all eight (`$key`). Raw vibration is left out:
// its samples are an array, not fields.
import type { Catalog, CatalogTopic } from 'creator';
import { MACHINES } from '../core/machines';
import { SLOW_KEEP_MS } from '../core/retention';

/** The merged, per-machine topics (merged.ts). */
export const MERGED = {
  scalars: 'plant.scalars',
  health: 'plant.health',
  spectrum: 'plant.spectrum',
} as const;

/** How long the merged spectrum is kept: as long as each machine's (30 s). */
export const SPECTRUM_KEEP_MS = 30_000;

const machine = { label: 'Machine', values: MACHINES } as const;

export const SCALARS: CatalogTopic = {
  name: MERGED.scalars,
  title: 'Slow signals (every 200 ms per machine)',
  key: machine,
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'machine', type: 'string', label: 'Machine' },
    { name: 'speed', type: 'number', label: 'Speed', unit: 'rpm' },
    { name: 'power', type: 'number', label: 'Power', unit: 'kW' },
    { name: 'pressure', type: 'number', label: 'Pressure', unit: 'bar' },
    { name: 'bearingTemp', type: 'number', label: 'Bearing temp', unit: '°C' },
    { name: 'exhaustTemp', type: 'number', label: 'Exhaust temp', unit: '°C' },
  ],
  history: SLOW_KEEP_MS,
  time: 'ts',
};

export const HEALTH: CatalogTopic = {
  name: MERGED.health,
  title: 'Machine health (every second per machine)',
  key: machine,
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'machine', type: 'string', label: 'Machine' },
    { name: 'score', type: 'number', label: 'Health score' },
    { name: 'status', type: 'string', label: 'Status' },
    { name: 'vibRms', type: 'number', label: 'Vibration RMS', unit: 'mm/s' },
    { name: 'bearing', type: 'number', label: 'Bearing frequency amplitude', unit: 'mm/s' },
    { name: 'bearingTemp', type: 'number', label: 'Bearing temp', unit: '°C' },
    { name: 'exhaustTemp', type: 'number', label: 'Exhaust temp', unit: '°C' },
    { name: 'power', type: 'number', label: 'Power', unit: 'kW' },
    { name: 'speed', type: 'number', label: 'Speed', unit: 'rpm' },
  ],
  history: SLOW_KEEP_MS,
  time: 'ts',
};

export const SPECTRUM: CatalogTopic = {
  name: MERGED.spectrum,
  title: 'Vibration spectrum summary (every 256 samples per machine)',
  key: machine,
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'machine', type: 'string', label: 'Machine' },
    { name: 'rms', type: 'number', label: 'Vibration RMS', unit: 'mm/s' },
    { name: 'peak', type: 'number', label: 'Peak amplitude', unit: 'mm/s' },
    { name: 'peakHz', type: 'number', label: 'Peak frequency', unit: 'Hz' },
  ],
  history: SPECTRUM_KEEP_MS,
  time: 'ts',
};

export const FLEET: CatalogTopic = {
  name: 'plant.fleet',
  title: 'Fleet (every second)',
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'totalPower', type: 'number', label: 'Total power', unit: 'kW' },
    { name: 'meanHealth', type: 'number', label: 'Mean health score' },
  ],
  // Kept as the last 300 records (5 minutes at one a second); offered as 2.
  history: SLOW_KEEP_MS,
  time: 'ts',
};

export const ALARMS: CatalogTopic = {
  name: 'plant.alarms',
  title: 'Alarms',
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'machine', type: 'string', label: 'Machine' },
    { name: 'sensor', type: 'string', label: 'Sensor' },
    { name: 'level', type: 'string', label: 'Level' },
    { name: 'state', type: 'string', label: 'State' },
    { name: 'value', type: 'number', label: 'Value' },
    { name: 'limit', type: 'number', label: 'Limit' },
  ],
  // Kept as the last 10,000 records; windows are offered over 2 minutes.
  history: SLOW_KEEP_MS,
  time: 'ts',
};

export const EVENTS: CatalogTopic = {
  name: 'plant.events',
  title: 'Events',
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'machine', type: 'string', label: 'Machine' },
    { name: 'kind', type: 'string', label: 'Kind' },
    { name: 'text', type: 'string', label: 'Text' },
  ],
  history: SLOW_KEEP_MS,
  time: 'ts',
};

export const CATALOG: Catalog = { topics: [SCALARS, HEALTH, SPECTRUM, FLEET, ALARMS, EVENTS] };
