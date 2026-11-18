/** @jsxImportSource preact */
import type { ComponentChildren, VNode } from 'preact';
import { Callout, Frame } from 'ui/components';
import type { Diagram, DiagramName } from '../../build/diagrams.ts';
import { featuresPage, howItWorks as h } from '../copy.ts';
import { Code, CodeTabs } from './code.tsx';
import { rich } from './rich.tsx';
import { PageIntro } from './intro.tsx';
import type { Page, SiteData } from './types.ts';

const POOLS_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/pools.md';
const HOSTING_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/hosting.md';

type Part = 'host' | 'bus' | 'isolate' | 'pool';

/** One step of the walkthrough: its heading in the gutter, with the bar of its part of the system. */
function Step({
  id,
  part,
  heading,
  children,
}: {
  id: string;
  part: Part;
  heading: string;
  children: ComponentChildren;
}): VNode {
  return (
    <section class="ui-gutter" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} data-part={part}>
        {heading}
      </h2>
      <div class="ui-body">{children}</div>
    </section>
  );
}

const paras = (text: readonly string[]): VNode[] => text.map((t) => <p key={t}>{rich(t)}</p>);

function HowItWorks({ diagrams, pin, samples }: SiteData): VNode {
  const byName = new Map<DiagramName, Diagram>(diagrams.map((d) => [d.name, d]));
  /** A pinned diagram, framed; nothing if the build didn't bring it. */
  const diagram = (name: DiagramName): VNode | null => {
    const d = byName.get(name);
    if (!d) return null;
    const href = `/how-it-works/diagrams/${d.name}.html`;
    return (
      <Frame
        src={href}
        title={`Diagram: ${d.title}`}
        height={560}
        open={{ href, label: `${h.open}: ${d.title}` }}
      />
    );
  };
  const s = h.sections;
  return (
    <main class="ui-shell">
      <PageIntro title={h.heading}>
        {h.intro.map((t, i) => (
          <p key={t} class={i === 0 ? 'ui-lede' : undefined}>
            {t}
          </p>
        ))}
      </PageIntro>
      <Step id="overview" part="host" heading={h.overview.heading}>
        {paras(h.overview.text)}
        {diagram('runtime-topology')}
      </Step>

      <Step id="host" part="host" heading={s.host.heading}>
        {paras(s.host.text)}
        <Code>{samples.howHost}</Code>
      </Step>

      <Step id="placement" part="pool" heading={s.placement.heading}>
        {paras(s.placement.text)}
        <Code>{samples.placement}</Code>
        {diagram('placement')}
        <p>
          <a href={POOLS_GUIDE}>{s.placement.link}</a>
        </p>
      </Step>

      <Step id="bus" part="bus" heading={s.bus.heading}>
        {paras(s.bus.text)}
        <Code>{samples.contracts}</Code>
        {paras(s.bus.flow)}
        <Code>{samples.vanilla}</Code>
        {diagram('bus-publish')}
      </Step>

      <Step id="render" part="isolate" heading={s.render.heading}>
        {paras(s.render.text)}
        <CodeTabs
          id="render"
          label="The same counter as a component"
          tabs={[
            { key: 'react', label: 'React', code: samples.react },
            { key: 'preact', label: 'Preact', code: samples.preact },
          ]}
        />
      </Step>

      <Step id="supervisor" part="host" heading={s.supervisor.heading}>
        {paras(s.supervisor.text)}
        <Code>{samples.howSupervision}</Code>
        {diagram('isolate-lifecycle')}
      </Step>

      <Step id="restart" part="isolate" heading={s.restart.heading}>
        {paras(s.restart.text)}
        <Code>{samples.howCatchUp}</Code>
        {diagram('restart-own-worker')}
        {diagram('restart-pool')}
      </Step>

      <Step id="bus-crash" part="bus" heading={s.busCrash.heading}>
        {paras(s.busCrash.text)}
        <Code>{samples.durable}</Code>
        {diagram('bus-crash-reattach')}
      </Step>

      <Step id="safety" part="host" heading={s.safety.heading}>
        <dl class="facts">
          {featuresPage.safety.facts.map(([term, text]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{rich(text)}</dd>
            </div>
          ))}
        </dl>
        {paras(s.safety.text)}
        <Code>{samples.grants}</Code>
        <p>
          <a href="/features/#safety">{s.safety.link}</a>
        </p>
      </Step>

      <section class="ui-gutter" aria-labelledby="policy">
        <h2 id="policy">{h.policy.heading}</h2>
        <div class="ui-body">
          <Callout>
            <p>{h.policy.text}</p>
            <p>
              <a href={HOSTING_GUIDE}>{h.policy.link}</a>
            </p>
          </Callout>
        </div>
      </section>

      <section class="ui-gutter" aria-labelledby="next">
        <h2 id="next">{h.next.heading}</h2>
        <div class="ui-body">
          <ul>
            {h.next.links.map(([href, label]) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
          <p>
            <small>
              {h.pinned}{' '}
              <a href={`https://github.com/isoloop/isoloop/tree/${pin}/docs/diagrams`}>
                <code>{pin.slice(0, 7)}</code>
              </a>
            </small>
          </p>
        </div>
      </section>
    </main>
  );
}

export const howItWorksPage: Page = {
  path: '/how-it-works/',
  section: 'how-it-works',
  head: { title: h.title, description: h.description },
  scripts: ['/src/demos/how-it-works.ts'],
  render: (data) => <HowItWorks {...data} />,
};
