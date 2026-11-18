/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { Callout, Frame } from 'ui/components';
import type { Diagram, DiagramName } from '../../build/diagrams.ts';
import { featuresPage, howItWorks as h } from '../copy.ts';
import { Code, CodeTabs } from './code.tsx';
import { rich } from './rich.tsx';
import { PageIntro } from './intro.tsx';
import type { Page, SiteData } from './types.ts';

const POOLS_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/pools.md';
const PLANT_MATCHED =
  'https://github.com/isoloop/web/tree/main/apps/dashboards/plant/comparison/matched-v2';
const HOSTING_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/hosting.md';

type Part = 'host' | 'bus' | 'isolate' | 'pool';
type StepId = keyof typeof h.nav.names;

interface Step {
  id: StepId;
  part: Part;
  heading: string;
  body: VNode;
  diagrams: DiagramName[];
}

const paras = (text: readonly string[]): VNode[] => text.map((t) => <p key={t}>{rich(t)}</p>);

/** The step's id in the URL. */
const anchor = (id: StepId): string => (id === 'busCrash' ? 'persistence' : id);

/** A pinned diagram, framed full width, with how to read it in words. */
function DiagramBlock({ d }: { d: Diagram }): VNode {
  // On the page, `?embed=1`: the drawing alone, without the viewer's controls.
  // Full size, `?present=1`: its presentation stage, with every control.
  const page = `/how-it-works/diagrams/${d.name}.html`;
  const href = `${page}?present=1`;
  const r = h.reading.diagrams[d.name];
  return (
    <div class="hiw-diagram" data-ratio={d.ratio?.toFixed(4)}>
      <Frame
        src={`${page}?embed=1`}
        title={`Diagram: ${d.title}`}
        height={760}
        open={{ href, label: `${h.open}: ${d.title}` }}
      />
      <div class="hiw-read">
        <h3>
          {h.reading.heading}: {d.title}
        </h3>
        <p class="hiw-read-lead">{rich(r.lead)}</p>
        <div class="hiw-read-cols">
          <div>
            <h4>{h.reading.parts}</h4>
            <dl>
              {r.parts.map(([term, text]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{rich(text)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h4>{h.reading.steps}</h4>
            <ol>
              {r.steps.map((t) => (
                <li key={t}>{rich(t)}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorks({ diagrams, pin, samples }: SiteData): VNode {
  const byName = new Map<DiagramName, Diagram>(diagrams.map((d) => [d.name, d]));
  const s = h.sections;
  const steps: Step[] = [
    {
      id: 'overview',
      part: 'host',
      heading: h.overview.heading,
      body: <>{paras(h.overview.text)}</>,
      diagrams: ['runtime-topology'],
    },
    {
      id: 'host',
      part: 'host',
      heading: s.host.heading,
      body: (
        <>
          {paras(s.host.text)}
          <CodeTabs
            id="host"
            label={s.host.code.label}
            tabs={[
              { key: 'main', label: s.host.code.host, code: samples.howHost },
              { key: 'counter', label: s.host.code.isolate, code: samples.vanilla },
            ]}
          />
        </>
      ),
      diagrams: [],
    },
    {
      id: 'placement',
      part: 'pool',
      heading: s.placement.heading,
      body: (
        <>
          {paras(s.placement.text)}
          <Code>{samples.howPlacement}</Code>
          <ul>
            <li>
              <a href={`${POOLS_GUIDE}#when-to-pool-and-when-not-to-the-plant-dashboards-figures`}>
                {s.placement.link}
              </a>
            </li>
            <li>
              <a href={PLANT_MATCHED}>{s.placement.results}</a>
            </li>
          </ul>
        </>
      ),
      diagrams: ['placement'],
    },
    {
      id: 'bus',
      part: 'bus',
      heading: s.bus.heading,
      body: (
        <>
          {paras(s.bus.text)}
          <Code>{samples.topics}</Code>
          {paras(s.bus.flow)}
          <Code>{samples.howPubSub}</Code>
        </>
      ),
      diagrams: ['bus-publish'],
    },
    {
      id: 'render',
      part: 'isolate',
      heading: s.render.heading,
      body: (
        <>
          {paras(s.render.text)}
          <h3>{s.render.differs.heading}</h3>
          <ul>
            {s.render.differs.items.map((t) => (
              <li key={t}>{rich(t)}</li>
            ))}
          </ul>
          <p>{s.render.code}:</p>
          <CodeTabs
            id="render"
            label={s.render.code}
            tabs={[
              { key: 'react', label: 'React', code: samples.react },
              { key: 'preact', label: 'Preact', code: samples.preact },
            ]}
          />
        </>
      ),
      diagrams: [],
    },
    {
      id: 'supervisor',
      part: 'host',
      heading: s.supervisor.heading,
      body: (
        <>
          {paras(s.supervisor.text)}
          <Code>{samples.howSupervision}</Code>
        </>
      ),
      diagrams: ['isolate-lifecycle'],
    },
    {
      id: 'restart',
      part: 'isolate',
      heading: s.restart.heading,
      body: (
        <>
          {paras(s.restart.text)}
          <ul>
            {s.restart.from.map((t) => (
              <li key={t}>{rich(t)}</li>
            ))}
          </ul>
          <Code>{samples.howCatchUp}</Code>
          <p>
            {rich(s.restart.cost)}{' '}
            <a href={`${POOLS_GUIDE}#when-to-pool-and-when-not-to-the-plant-dashboards-figures`}>
              {s.restart.costLink}
            </a>
            {' · '}
            <a href={PLANT_MATCHED}>{s.restart.results}</a>
          </p>
          <p>{rich(s.restart.pool)}</p>
        </>
      ),
      diagrams: ['restart-own-worker', 'restart-pool'],
    },
    {
      id: 'busCrash',
      part: 'bus',
      heading: s.busCrash.heading,
      body: (
        <>
          {paras(s.busCrash.text)}
          <CodeTabs
            id="persistence"
            label={s.busCrash.code.label}
            tabs={[
              { key: 'topics', label: s.busCrash.code.topics, code: samples.durable },
              { key: 'alarms', label: s.busCrash.code.isolate, code: samples.howPersistence },
            ]}
          />
          <h3>{s.busCrash.crash.heading}</h3>
          {paras(s.busCrash.crash.text)}
        </>
      ),
      diagrams: ['bus-crash-reattach'],
    },
    {
      id: 'safety',
      part: 'host',
      heading: s.safety.heading,
      body: (
        <>
          <Callout>
            <p>{rich(s.safety.threat)}</p>
          </Callout>
          <dl class="facts">
            {featuresPage.safety.facts.map(([term, text]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{rich(text)}</dd>
              </div>
            ))}
          </dl>
          {paras(s.safety.text)}
          <Code>{samples.howGrants}</Code>
          <p>
            <a href="/features/#safety">{s.safety.link}</a>
          </p>
        </>
      ),
      diagrams: [],
    },
  ];

  return (
    <main class="ui-shell">
      <PageIntro title={h.heading}>
        {h.intro.map((t, i) => (
          <p key={t} class={i === 0 ? 'ui-lede' : undefined}>
            {t}
          </p>
        ))}
      </PageIntro>

      {/* Without JS every step shows, one after another, and the nav is a list of contents (src/demos/how-it-works.ts). */}
      <div class="hiw" data-steps>
        <nav class="hiw-nav" aria-label={h.nav.label}>
          <ol>
            {steps.map((st) => (
              <li key={st.id} data-part={st.part}>
                <a href={`#${anchor(st.id)}`}>{h.nav.names[st.id]}</a>
              </li>
            ))}
          </ol>
        </nav>
        {steps.map((st, i) => {
          const prev = steps[i - 1];
          const next = steps[i + 1];
          const id = anchor(st.id);
          return (
            <section class="hiw-step" id={id} aria-labelledby={`${id}-h`} data-step key={st.id}>
              <h2 id={`${id}-h`} data-part={st.part}>
                {st.heading}
              </h2>
              <div class="hiw-text">{st.body}</div>
              {st.diagrams.map((name) => {
                const d = byName.get(name);
                return d ? <DiagramBlock d={d} key={name} /> : null;
              })}
              <p class="hiw-pager">
                {prev ? (
                  <a href={`#${anchor(prev.id)}`} rel="prev">
                    ← {h.nav.previous}: {h.nav.names[prev.id]}
                  </a>
                ) : (
                  <span />
                )}
                {next ? (
                  <a href={`#${anchor(next.id)}`} rel="next">
                    {h.nav.next}: {h.nav.names[next.id]} →
                  </a>
                ) : null}
              </p>
            </section>
          );
        })}
      </div>

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
