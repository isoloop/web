/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Feature } from '../../build/features.ts';
import { marks } from '../copy.ts';

/** The Experimental pill after a feature's name, if the feature is experimental (ADR 0005). */
export function Pill({ feature }: { feature: Pick<Feature, 'experimental'> }): VNode | null {
  return feature.experimental ? <span class="ui-pill">{marks.experimental}</span> : null;
}

/**
 * A feature's strip item: its name in bold and the pill on one line, then its
 * line below, on every item alike (a description run on after the pill left
 * its first word on the pill's line).
 */
export function StripItem({ feature, href }: { feature: Feature; href: string }): VNode {
  return (
    <li data-part={feature.part}>
      <a href={href}>
        <b>{feature.name}</b> <Pill feature={feature} />{' '}
        <span class="ui-strip-line">{feature.line}</span>
      </a>
    </li>
  );
}
