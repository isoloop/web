/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { featureSchema, type Feature } from '../../build/features.ts';
import { featuresPage as f } from '../copy.ts';
import { Pill } from './pill.tsx';

/**
 * Each tab's colour, from its part of the system (ADR 0005). The tabs and
 * their order are the schema's (build/features.ts); a Record, so a tab added
 * there fails the type check until it has a colour here.
 */
const TAB_PARTS: Record<Feature['tab'], Feature['part']> = {
  isolation: 'isolate',
  bus: 'bus',
  placement: 'pool',
  tools: 'host',
  safety: 'host',
  cost: 'cost',
};
export const TABS = featureSchema.shape.tab.options.map((t) => [t, TAB_PARTS[t]] as const);

/**
 * The opening of /features/ (ADR 0005, as amended): a board of sticky notes,
 * one column per tab, one note per feature, tinted in its tab's colour. A
 * column's title opens its tab; a note opens its feature.
 */
export function FeatureNotes({ features }: { features: Feature[] }): VNode {
  return (
    <figure class="fnotes" aria-label={f.notes.label}>
      {TABS.map(([tab, part]) => (
        <section class="fnotes-col" data-part={part} key={tab}>
          <h3>
            <a href={`#${f.tabs.ids[tab]}`}>{f.tabs.names[tab]}</a>
          </h3>
          <ul>
            {features
              .filter((x) => x.tab === tab)
              .map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`}>
                    {x.name.replace(/\.$/, '')} <Pill feature={x} />
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </figure>
  );
}
