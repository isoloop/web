/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { Table } from 'ui/components';
import { home, site } from '../copy.ts';
import { Code, CodeTabs } from './code.tsx';
import { findBlock, MeasuredBlock } from './measurements.tsx';
import { Recording } from './recording.tsx';
import { PageIntro } from './intro.tsx';
import type { Page, SiteData } from './types.ts';

const PLANT_SOURCE = 'https://github.com/isoloop/web/tree/main/apps/dashboards/plant';

/** The landing page, in the order ADR 0002's amendments set. */
function Home({ features, samples, examples }: SiteData): VNode {
  return (
    <main class="ui-shell">
      <PageIntro title={home.intro.heading} id="intro">
        <p class="ui-lede">{home.intro.text}</p>
        <p class="ui-actions">
          <a class="ui-button" data-primary href="/features/">
            {home.intro.primary}
          </a>
          <a href="/examples/">{home.intro.secondary}</a>
        </p>
      </PageIntro>

      <section class="ui-try-section" id="try" aria-label="Try it">
        <p class="ui-try">{home.try}</p>
        <Recording
          id="rec"
          tracks={['main', 'bus', 'A', 'B', 'pool']}
          controls={['block-c', 'crash-a', 'block-main']}
          code={
            <details class="ui-demo-code" id="code">
              <summary>{home.code.summary}</summary>
              <p>{home.code.intro}</p>
              <CodeTabs
                id="code"
                label={home.code.label}
                tabs={[
                  { key: 'host', label: home.code.files.host, code: samples.demoMain },
                  { key: 'isolate', label: home.code.files.isolate, code: samples.demoCounter },
                  { key: 'topics', label: home.code.files.topics, code: samples.demoTopics },
                ]}
              />
              <p>
                <a href={home.code.source}>{home.code.more}</a>
              </p>
            </details>
          }
        />
      </section>

      <section class="ui-gutter" id="for" aria-labelledby="for-h">
        <h2 id="for-h">{home.uses.heading}</h2>
        <div class="ui-body">
          <ul class="ui-uses">
            {home.uses.items.map(([pattern, example]) => (
              <li key={pattern}>
                <b>{pattern}</b> <span class="ui-eg">e.g. {example}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section class="ui-gutter" id="features" aria-labelledby="features-h">
        <h2 id="features-h">{home.strip.heading}</h2>
        <div class="ui-body">
          <nav class="ui-strip" aria-labelledby="features-h">
            <ul>
              {features.map((f) => (
                <li key={f.id} data-part={f.part}>
                  <a href={`/features/#${f.id}`}>
                    <b>{f.name}</b> {f.line}
                  </a>
                </li>
              ))}
            </ul>
            <a href="/features/">{home.strip.all}</a>
          </nav>
        </div>
      </section>

      <section class="ui-gutter" id="gives" aria-labelledby="gives-h">
        <h2 id="gives-h">{home.gives.heading}</h2>
        <div class="ui-body">
          <Table
            caption={home.gives.caption}
            head={home.gives.head}
            rows={home.gives.rows}
            markLast
          />
          <p>
            <a href={`${PLANT_SOURCE}#what-each-build-does-when-something-goes-wrong`}>
              {home.gives.more}
            </a>
          </p>
        </div>
      </section>

      <section class="ui-gutter" id="costs" aria-labelledby="costs-h">
        <h2 id="costs-h">{home.costs.heading}</h2>
        <div class="ui-body">
          <MeasuredBlock
            block={findBlock(examples, 'dashboards/plant', 'desktop')}
            findings={home.costs.findings}
            more={home.costs.more}
            level={3}
          />
        </div>
      </section>

      <section class="ui-gutter" id="limits" aria-labelledby="limits-h">
        <h2 id="limits-h">{home.limits.heading}</h2>
        <div class="ui-body">
          <ul class="ui-limits">
            {home.limits.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </section>

      <section class="ui-gutter" id="how" aria-labelledby="how-h">
        <h2 id="how-h">{home.how.heading}</h2>
        <div class="ui-body">
          {home.how.text.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <p>
            <a href="/how-it-works/">{home.how.link}</a>
          </p>
        </div>
      </section>
      <section class="ui-gutter" id="install" aria-labelledby="install-h">
        <h2 id="install-h">{home.install.heading}</h2>
        <div class="ui-body">
          <p>{home.install.platform}</p>
          <p>{home.install.label}</p>
          <Code lang="sh">{home.install.command}</Code>
          <p>
            <a href="https://github.com/isoloop/isoloop/blob/main/docs/guide/hosting.md">
              {home.install.guide}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

export const homePage: Page = {
  path: '/',
  section: 'home',
  head: { title: home.title, description: site.description, home: true },
  scripts: ['/src/demos/home.ts'],
  render: (data) => <Home {...data} />,
};
