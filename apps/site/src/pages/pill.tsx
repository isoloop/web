/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Feature } from '../../build/features.ts';
import { marks } from '../copy.ts';

/** The Experimental pill after a feature's name, if the feature is experimental (ADR 0005). */
export function Pill({ feature }: { feature: Pick<Feature, 'experimental'> }): VNode | null {
  return feature.experimental ? <span class="ui-pill">{marks.experimental}</span> : null;
}

/** A feature's strip item: its name in bold, the pill, then its line. */
export function StripItem({ feature, href }: { feature: Feature; href: string }): VNode {
  return (
    <li data-part={feature.part}>
      <a href={href}>
        <b>{feature.name}</b> <Pill feature={feature} /> {feature.line}
      </a>
    </li>
  );
}
