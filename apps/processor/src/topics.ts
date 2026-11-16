// Topic handles for isolate code: the contracts' types, and only the name at
// run time, so Zod stays out of the task workers.
import type * as C from './contracts';

function handle<T extends { name: string }>(name: T['name']): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bus client reads only `name`; the types come from the contracts
  return { name, schema: { '~standard': {} } } as unknown as T;
}

export const tasks: typeof C.tasks = handle('playground.tasks.v1');
export const control: typeof C.control = handle('playground.control.v1');
