/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { featureSchema, type Feature } from '../../build/features.ts';
import { featuresPage as f } from '../copy.ts';
import { Pill } from './pill.tsx';

type Box = Exclude<Feature['blueprint'], 'cost'>;

/**
 * Each box's colour, from its part of the system (ADR 0003). The boxes and
 * their drawing order are the schema's (build/features.ts); a Record, so a
 * place added there fails the type check until it has a colour here.
 */
const BOX_PARTS: Record<Box, Feature['part']> = {
  host: 'host',
  bus: 'bus',
  isolate: 'isolate',
  pool: 'pool',
  devtools: 'isolate',
};
const BOXES = featureSchema.shape.blueprint.options
  .filter((b): b is Box => b !== 'cost')
  .map((b) => [b, BOX_PARTS[b]] as const);

function Tag({ feature }: { feature: Feature }): VNode {
  return (
    <li>
      <a href={`#${feature.id}`}>
        {feature.name.replace(/\.$/, '')} <Pill feature={feature} />
      </a>
    </li>
  );
}

/**
 * The opening of /features/ (ADR 0005): a blueprint of the system, each
 * feature pinned on the part it runs in (its `blueprint` field), the cost as a
 * dimension line along the bottom. Every title links to its section. Laid out
 * in CSS grid (src/site.css): two rows on wide screens, one column on phones.
 */
export function FeatureMap({ features }: { features: Feature[] }): VNode {
  const on = (b: Feature['blueprint']): Feature[] => features.filter((x) => x.blueprint === b);
  return (
    <figure class="fmap" aria-label={f.map.label}>
      {BOXES.map(([box, part]) => (
        <section class={`fmap-box fmap-${box}`} data-part={part} key={box}>
          <h3>
            {f.map.boxes[box][0]} <span>{f.map.boxes[box][1]}</span>
          </h3>
          <ul>
            {on(box).map((x) => (
              <Tag key={x.id} feature={x} />
            ))}
          </ul>
        </section>
      ))}
      {on('cost').map((x) => (
        <p class="fmap-cost" key={x.id}>
          <span>{f.map.costNote}</span>
          <a href={`#${x.id}`}>{x.name.replace(/\.$/, '')}</a>
        </p>
      ))}
    </figure>
  );
}
