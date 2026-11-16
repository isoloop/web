import type { ViewSize } from './size';

/** What every view takes. `output` is undefined until the pipeline's first result. */
export interface ViewProps<O> {
  output: O | undefined;
  /** The widget's title. */
  title: string;
  size: ViewSize;
}
