/** @jsxImportSource preact */
import type { ComponentChildren, VNode } from 'preact';

export type Part = 'host' | 'bus' | 'isolate' | 'pool';

export interface Step {
  /** The step's id in the URL (`#id`) and on its section. */
  id: string;
  /** Its tab's short name. */
  name: string;
  heading: string;
  /** The colour bar of its part of the system, if it has one. */
  part?: Part;
  children: ComponentChildren;
}

/**
 * Steps as tabs (src/demos/steps.ts): a row of links to each step's `#id`,
 * sticky under the header, one step shown at a time, Previous and Next under
 * each. Without JS every step shows, one after another, and the tabs are a
 * list of contents. Used by /how-it-works/ and /examples/; /features/ uses
 * the same script (src/demos/steps.ts) with its own panels (ADR 0005).
 */
export function StepTabs({
  label,
  steps,
  previous,
  next,
}: {
  label: string;
  steps: Step[];
  previous: string;
  next: string;
}): VNode {
  return (
    <div class="steps" data-steps>
      <nav class="steps-nav" aria-label={label}>
        <ol>
          {steps.map((st) => (
            <li key={st.id} data-part={st.part}>
              <a href={`#${st.id}`}>{st.name}</a>
            </li>
          ))}
        </ol>
      </nav>
      {steps.map((st, i) => {
        const prev = steps[i - 1];
        const after = steps[i + 1];
        return (
          <section
            class="steps-step"
            id={st.id}
            aria-labelledby={`${st.id}-h`}
            data-step
            key={st.id}
          >
            <h2 id={`${st.id}-h`} data-part={st.part}>
              {st.heading}
            </h2>
            {st.children}
            <p class="steps-pager">
              {prev ? (
                <a href={`#${prev.id}`} rel="prev">
                  ← {previous}: {prev.name}
                </a>
              ) : (
                <span />
              )}
              {after ? (
                <a href={`#${after.id}`} rel="next">
                  {next}: {after.name} →
                </a>
              ) : null}
            </p>
          </section>
        );
      })}
    </div>
  );
}
