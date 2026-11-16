// Topic handles for isolate code: the contracts' types, and only the name at
// run time, so Zod stays out of the task workers.
import type * as C from './contracts';

function handle<T extends { name: string }>(name: T['name']): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bus client reads only `name`; the types come from the contracts
  return { name, schema: { '~standard': {} } } as unknown as T;
}

export const tasks: typeof C.tasks = handle('playground.tasks.v1');
export const control: typeof C.control = handle('playground.control.v1');
export const csvJobs: typeof C.csvJobs = handle('files.jobs.csv.v1');
export const imageJobs: typeof C.imageJobs = handle('files.jobs.image.v1');
export const archiveJobs: typeof C.archiveJobs = handle('files.jobs.archive.v1');
export const hashJobs: typeof C.hashJobs = handle('files.jobs.hash.v1');
export const results: typeof C.results = handle('files.results.v1');
export const dials: typeof C.dials = handle('files.dials.v1');
