import type { VNode } from 'preact';
import type { Alternatives } from '../../build/alternatives.ts';
import type { Benchmarks } from '../../build/benchmarks.ts';
import type { Changelog } from '../../build/changelog.ts';
import type { Diagram } from '../../build/diagrams.ts';
import type { Doc, NavSection } from '../../build/docs/pages.ts';
import type { Example } from '../../build/examples.ts';
import type { Feature } from '../../build/features.ts';
import type { Samples } from '../../build/samples.ts';
import type { Current, HeadProps } from 'ui/components';

/** What every page is rendered from, gathered at build time. */
export interface SiteData {
  examples: Example[];
  /** /changelog/: each library package's changelog at the pin (build/changelog.ts). */
  changelog: Changelog;
  /** The features on /features/ and the landing strip, in order (content/features/). */
  features: Feature[];
  /** Isoloop and the alternatives, for the home table and the Compared tab (content/alternatives.json). */
  alternatives: Alternatives;
  diagrams: Diagram[];
  /** The isoloop/isoloop sha the diagrams come from. */
  pin: string;
  /** The /features/ code, type-checked in apps/samples. */
  samples: Samples;
  /** The docs pages, in docs.json order (build/docs/pages.ts). */
  docs: Doc[];
  /** The sidebar's and /docs/'s sections: each page, and links into them (Kernel config). */
  docsNav: NavSection[];
  /** The `@isoloop/*` version at the pin, which the docs describe. */
  libraryVersion: string;
  /** /benchmarks/: the runs in content/benchmarks.json (build/benchmarks.ts). */
  benchmarks: Benchmarks;
}

export interface Page {
  /** The page's own path, for the canonical URL and og:url. */
  path: string;
  /** The header's section, if the page is one. */
  section?: Current;
  head: Pick<HeadProps, 'title' | 'searchTitle' | 'description' | 'home' | 'robots'>;
  /** A JSON-LD data block for its <head>, which doesn't execute (ADR 0002, decision 8, as amended). */
  jsonLd?: object;
  /** Module scripts the page runs, root-absolute (the live demos), bundled by Vite. */
  scripts?: string[];
  render: (data: SiteData) => VNode;
}
