// The contract between the native + workers host and the parts another team
// ships apart (M3g decision 2): types only, so neither bundle carries the
// other's code. The host passes its store as `host`; nothing else is shared.
import type { Source } from '../core/streams';

/** What the host hands a part: the page's streams, to read and publish. */
export type PartHost = Source;

/** The slot the part is mounted in, and its widget config. */
export interface PartProps {
  slot: string;
  config?: unknown;
}

/** A part's module: `mount` renders it into `el` and returns its unmount. */
export interface PartModule {
  mount: (el: HTMLElement, host: PartHost, props: PartProps) => () => void;
}

/** `parts-manifest.json`, written next to the parts by their build. */
export interface PartsManifest {
  parts: Record<string, { entry: string; css?: string[] | undefined }>;
}
