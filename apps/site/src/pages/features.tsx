/** @jsxImportSource preact */
import type { ComponentChildren, VNode } from 'preact';
import { Table } from 'ui/components';
import type { Feature as Entry } from '../../build/features.ts';
import { featuresPage as f, home } from '../copy.ts';
import { Recording } from './recording.tsx';
import { Code, CodeTabs } from './code.tsx';
import { findBlock, MeasuredBlock } from './measurements.tsx';
import { rich } from './rich.tsx';
import { PageIntro } from './intro.tsx';
import type { Page, SiteData } from './types.ts';

const PLANT_RESULTS = 'https://github.com/isoloop/web/tree/main/apps/dashboards/plant/comparison';
const POOLS_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/pools.md';
const HOSTING_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/hosting.md';
const BALANCER_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/balancer.md';
const PROCESSOR = '/examples/processor/';
const AGENTS_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/agents.md';
const DEVTOOLS_GUIDE = 'https://github.com/isoloop/isoloop/blob/main/docs/guide/devtools.md';
const PLANT_DEVTOOLS = '/examples/dashboards/plant/isoloop/?devtools=1';
const MARKETS_TOOLS =
  'https://github.com/isoloop/web/blob/main/apps/dashboards/markets/src/isoloop/contracts.ts';

/** A feature's section: its heading in the gutter, with the bar of its part of the system, then its text and its figure. */
function Feature({ entry, children }: { entry: Entry; children: ComponentChildren }): VNode {
  return (
    <section class="ui-gutter" id={entry.id} aria-labelledby={`${entry.id}-h`}>
      <h2 id={`${entry.id}-h`} data-part={entry.part}>
        {entry.name.replace(/\.$/, '')}
      </h2>
      <div class="ui-body">
        {entry.text.map((t) => (
          <p key={t}>{rich(t)}</p>
        ))}
        {children}
      </div>
    </section>
  );
}

function Features({ samples, features, examples }: SiteData): VNode {
  const demos: Record<Entry['demo'], VNode> = {
    recording: (
      <>
        <Recording
          id="containment-rec"
          tracks={['main', 'A', 'B', 'pool']}
          controls={['block-c', 'crash-a']}
          caption={<>{f.containment.caption}</>}
        />
      </>
    ),
    'restart-still': (
      <>
        <figure class="still" aria-labelledby="restart-cap">
          <div class="still-row" aria-hidden="true">
            <span class="still-label">{f.restart.rows.loop}</span>
            <div class="loop-line">
              <i class="tick" />
              <i class="tick" />
              <i class="tick" />
              <i class="tick" />
              <span class="stuck">
                <b>{f.restart.stuck}</b>
              </span>
              <span class="again">{f.restart.again}</span>
              <i class="tick" />
              <i class="tick" />
              <i class="tick" />
              <i class="tick" />
            </div>
          </div>
          <div class="still-row" aria-hidden="true">
            <span class="still-label">{f.restart.rows.reads}</span>
            <ol class="cells">
              <li>4134</li>
              <li>4135</li>
              <li>4136</li>
              <li class="commit">4137</li>
              <li class="read-again">4138</li>
              <li class="read-again">4139</li>
              <li class="fresh">4140</li>
              <li class="fresh">4141</li>
              <li class="fresh">4142</li>
            </ol>
          </div>
          <ul class="still-key" aria-hidden="true">
            <li class="k-commit">{f.restart.key.commit}</li>
            <li class="k-again">{f.restart.key.again}</li>
            <li class="k-fresh">{f.restart.key.fresh}</li>
          </ul>
          <figcaption id="restart-cap">{rich(f.restart.caption)}</figcaption>
        </figure>
      </>
    ),
    bus: (
      <>
        <figure class="demo" data-demo="bus" aria-labelledby="bus-cap">
          <div class="topics" aria-hidden="true">
            {f.bus.topics.map(([name, from]) => (
              <div class="topic" data-topic={name} key={name}>
                <p class="topic-name">
                  {name} <span>{from}</span>
                </p>
                <ol class="recs" />
                <p class="readers" />
              </div>
            ))}
          </div>
          <p class="ui-status" role="status" aria-live="polite">
            {f.bus.status}
          </p>
          <figcaption id="bus-cap">{f.bus.caption}</figcaption>
        </figure>
        <Code>{samples.contracts}</Code>
      </>
    ),
    replay: (
      <>
        <figure class="demo" data-demo="replay" aria-labelledby="replay-cap">
          <div class="tape" aria-hidden="true">
            <p class="tape-name">{f.replay.tape}</p>
            <ol class="tape-cells" />
          </div>
          <div class="ui-controls" role="group" aria-label="Try replay">
            <button type="button" class="ui-button" data-strong data-act="crash-d" disabled>
              {f.replay.crashD}
            </button>
            <p class="ui-status" role="status" aria-live="polite">
              {f.replay.status.reading}
            </p>
          </div>
          <figcaption id="replay-cap">{f.replay.caption}</figcaption>
        </figure>
      </>
    ),
    'durable-still': (
      <>
        <figure class="still" aria-labelledby="durable-cap">
          <div class="ui-table-wrap">
            <table class="ui-table reload">
              <thead>
                <tr>
                  {f.durable.head.map((h) => (
                    <th scope="col" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <code>count.v1</code>
                    <br />
                    <span>memory</span>
                  </th>
                  <td>
                    <span class="r">4131</span>
                    <span class="r">4132</span>
                    <span class="r">4133</span>
                    <span class="r">4134</span>
                  </td>
                  <td class="empty">empty</td>
                </tr>
                <tr>
                  <th scope="row">
                    <code>alarms.v1</code>
                    <br />
                    <span>persistent</span>
                  </th>
                  <td>
                    <span class="r">212</span>
                    <span class="r">213</span>
                    <span class="r">214</span>
                    <span class="r">215</span>
                  </td>
                  <td>
                    <span class="r">212</span>
                    <span class="r">213</span>
                    <span class="r">214</span>
                    <span class="r">215</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <figcaption id="durable-cap">{rich(f.durable.caption)}</figcaption>
        </figure>
        <Code>{samples.durable}</Code>
      </>
    ),
    'placement-still': (
      <>
        <figure class="still layouts" aria-labelledby="placement-cap">
          {f.placement.layouts.map(([name, loops, lanes]) => (
            <div class="layout" key={name}>
              <p class="layout-name">
                {name} <span>{loops}</span>
              </p>
              <div class="lanes">
                {lanes.map(([label, hit]) => (
                  <span class={hit ? 'lane hit' : 'lane'} key={label}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <figcaption id="placement-cap">{f.placement.caption}</figcaption>
        </figure>
        <Code>{samples.placement}</Code>
        <p>
          <a href={POOLS_GUIDE}>{f.placement.more}</a>
        </p>
      </>
    ),
    'balancer-table': (
      <>
        <Table caption={f.balancer.caption} head={f.balancer.head} rows={f.balancer.rows} />
        <Code>{samples.balancer}</Code>
        <p>
          <a href={BALANCER_GUIDE}>{f.balancer.guide}</a>
        </p>
        <p>
          <a href={PROCESSOR}>{f.balancer.example}</a>
        </p>
      </>
    ),
    'agents-code': (
      <>
        <Code>{samples.agents}</Code>
        <p>
          <a href={AGENTS_GUIDE}>{f.agents.guide}</a>
        </p>
        <p>
          <a href={MARKETS_TOOLS}>{f.agents.example}</a>
        </p>
      </>
    ),
    'devtools-code': (
      <>
        <Code>{samples.devtools}</Code>
        <p>
          <a href={DEVTOOLS_GUIDE}>{f.devtools.guide}</a>
        </p>
        <p>
          <a href={PLANT_DEVTOOLS}>{f.devtools.example}</a>
        </p>
      </>
    ),
    'framework-tabs': (
      <>
        <CodeTabs
          label="Framework"
          tabs={f.frameworks.tabs.map(([key, label]) => ({
            key,
            label,
            code:
              key === 'react' ? samples.react : key === 'preact' ? samples.preact : samples.vanilla,
          }))}
        />
      </>
    ),
    'safety-facts': (
      <>
        <dl class="facts">
          {f.safety.facts.map(([term, text]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>
                {rich(text)}
                {term === 'No inline code' ? (
                  <>
                    {' '}
                    <a href={HOSTING_GUIDE}>The hosting guide</a> has the full policy.
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        <Code>{samples.grants}</Code>
      </>
    ),
    'cost-table': (
      <>
        <MeasuredBlock
          block={findBlock(examples, 'dashboards/plant', 'desktop')}
          findings={home.costs.findings}
          more={home.costs.more}
          level={3}
        />
        <p>
          <a href={PLANT_RESULTS}>{f.cost.more}</a>
        </p>
      </>
    ),
  };
  return (
    <main class="ui-shell">
      <PageIntro
        title={f.heading}
        after={
          <nav class="ui-strip" aria-label="Features">
            <ul>
              {features.map((x) => (
                <li key={x.id} data-part={x.part}>
                  <a href={`#${x.id}`}>
                    <b>{x.name}</b> {x.line}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        <p class="ui-lede">{f.lede}</p>
        <p>
          <a href="/changelog/">{f.changelog}</a>
        </p>
      </PageIntro>

      {features.map((entry) => (
        <Feature key={entry.id} entry={entry}>
          {demos[entry.demo]}
        </Feature>
      ))}
    </main>
  );
}

export const featuresPage: Page = {
  path: '/features/',
  section: 'features',
  head: { title: f.title, description: f.description },
  scripts: ['/src/demos/features.ts'],
  render: (data) => <Features {...data} />,
};
