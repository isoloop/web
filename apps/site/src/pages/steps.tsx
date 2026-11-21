/** @jsxImportSource preact */
import type { ComponentChildren, VNode } from 'preact';
import { ExperimentalMark } from 'ui/components';
import { marks } from '../copy.ts';

export type Part = 'host' | 'bus' | 'isolate' | 'pool';

export interface Step {
  /** The step's id in the URL (`#id`) and on its section. */
  id: string;
  /** Its short name in the rail. */
  name: string;
  heading: string;
  /** The colour bar of its part of the system, if it has one. */
  part?: Part;
  children: ComponentChildren;
}

/** One link in the rail. `item` links name something inside a panel (a feature). */
export interface RailLink {
  href: string;
  text: string;
  part?: string | undefined;
  experimental?: boolean | undefined;
  item?: boolean;
}

/** A group of links; with a `title`, the title is a link to the group's panel. */
export interface RailGroup {
  title?: RailLink;
  items: RailLink[];
}

function LinkText({ link }: { link: RailLink }): VNode {
  if (!link.experimental) return <>{link.text}</>;
  const cut = link.text.lastIndexOf(' ') + 1;
  return (
    <>
      {link.text.slice(0, cut)}
      <span class="docs-side-last">
        {link.text.slice(cut)}
        <ExperimentalMark label={marks.experimental} />
      </span>
    </>
  );
}

/** The rail's links, exactly in the docs sidebar's look (src/pages/doc.tsx): no part colours; one accent bar on the current link. */
function RailNav({ label, groups }: { label: string; groups: RailGroup[] }): VNode {
  return (
    <nav class="docs-side rail" aria-label={label} data-rail>
      {groups.map((g, i) => (
        <div key={g.title?.href ?? i}>
          {g.title ? (
            <h2>
              <a href={g.title.href}>{g.title.text}</a>
            </h2>
          ) : null}
          <ul>
            {g.items.map((l) => (
              <li key={l.href}>
                <a href={l.href} data-item={l.item ? '' : undefined}>
                  <LinkText link={l} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * A page made of parts, with the rail (ADR 0005, amended 2026-11-21):
 * the rail on the left, sticky; one panel shown at a time (src/demos/steps.ts);
 * below 760px the rail folds into a <details> above the panel. Without JS
 * every panel shows, one after another, and the rail is a list of contents.
 */
export function RailLayout({
  label,
  groups,
  children,
}: {
  label: string;
  groups: RailGroup[];
  children: ComponentChildren;
}): VNode {
  return (
    <div class="rail-layout" data-steps>
      <div class="docs-only-wide rail-wide">
        <RailNav label={label} groups={groups} />
      </div>
      <div class="rail-main">
        <details class="docs-fold docs-only-narrow rail-fold">
          <summary>
            {label} <span data-rail-current />
          </summary>
          <RailNav label={label} groups={groups} />
        </details>
        {children}
      </div>
    </div>
  );
}

/** The Previous and Next links under a panel, as on the docs pages. */
export function Pager({
  prev,
  next,
  previous,
  nextLabel,
}: {
  prev?: { href: string; text: string } | undefined;
  next?: { href: string; text: string } | undefined;
  previous: string;
  nextLabel: string;
}): VNode | null {
  if (!prev && !next) return null;
  return (
    <nav class="docs-pager" aria-label={`${previous} and ${nextLabel.toLowerCase()}`}>
      {prev ? (
        <a href={prev.href} rel="prev">
          <span>{previous}</span>
          <b>{prev.text}</b>
        </a>
      ) : (
        <span />
      )}
      {next ? (
        <a href={next.href} rel="next" class="next">
          <span>{nextLabel}</span>
          <b>{next.text}</b>
        </a>
      ) : null}
    </nav>
  );
}

/** Steps in the rail, one at a time, Previous and Next under each. /how-it-works/ and /examples/. */
export function StepTabs({
  label,
  steps,
  previous,
  next,
  after,
}: {
  label: string;
  steps: Step[];
  previous: string;
  next: string;
  /** Shown under every step, after its pager: a footnote. */
  after?: ComponentChildren | undefined;
}): VNode {
  return (
    <RailLayout
      label={label}
      groups={[{ items: steps.map((st) => ({ href: `#${st.id}`, text: st.name, part: st.part })) }]}
    >
      {steps.map((st, i) => {
        const prev = steps[i - 1];
        const nxt = steps[i + 1];
        return (
          <section
            class="steps-step"
            id={st.id}
            aria-labelledby={`${st.id}-h`}
            data-step
            key={st.id}
          >
            <h2 class="panel-h" id={`${st.id}-h`} data-part={st.part}>
              {st.heading}
            </h2>
            {st.children}
            <Pager
              prev={prev ? { href: `#${prev.id}`, text: prev.name } : undefined}
              next={nxt ? { href: `#${nxt.id}`, text: nxt.name } : undefined}
              previous={previous}
              nextLabel={next}
            />
            {after}
          </section>
        );
      })}
    </RailLayout>
  );
}
