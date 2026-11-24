/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { ChartLegend, PairedBars, Table } from 'ui/components';
import { figure, withinSpread, type BenchRun, type FigureKey } from '../../build/benchmarks.ts';
import { compared, home, site } from '../copy.ts';
import { AlternativesSummary } from './alternatives.tsx';
import { measuredOn } from './benchmarks.tsx';
import { Code, CodeTabs } from './code.tsx';
import { Recording } from './recording.tsx';
import { PageIntro } from './intro.tsx';
import { StripItem } from './pill.tsx';
import { rich } from './rich.tsx';
import { homeData } from './structured-data.ts';
import type { Page, SiteData } from './types.ts';

const PLANT_SOURCE = 'https://github.com/isoloop/web/tree/main/apps/dashboards/plant';

/** The landing's charts: native + workers against Isoloop matched, Chromium at 5 kHz (ADR 0002, amended 2026-11-24). */
const PAIR = { engine: 'chromium', rate: 5, a: 'native-workers', b: 'isoloop:matched' } as const;

/** One small chart: one figure, the two bars and the measured difference in words. */
function Chart({ run, title, fig }: { run: BenchRun; title: string; fig: FigureKey }): VNode {
  const f = figure(run, { ...PAIR, figure: fig });
  return (
    <PairedBars
      title={title}
      unit={f.unit}
      base={home.costs.base}
      value={home.costs.value}
      rows={[
        {
          base: f.aMedian,
          value: f.bMedian,
          delta: f.delta,
          ...(withinSpread(f) ? { verdict: 'same' as const } : {}),
        },
      ]}
      {...(f.unit === '%' ? { max: Math.max(100, f.aMedian, f.bMedian) } : {})}
      legend={false}
      compact
    />
  );
}

/** "What it costs, and where it helps": two charts where Isoloop helps, two for what it costs, one legend. */
function Costs({ run }: { run: BenchRun }): VNode {
  const c = home.costs.charts;
  return (
    <>
      <p>{rich(home.costs.intro)}</p>
      <p class="home-measured">{rich(measuredOn(run))}</p>
      <div class="home-charts">
        <div>
          <h3>{home.costs.helps}</h3>
          <Chart run={run} title={c.mainThread} fig="mainThreadCpuPct" />
          <Chart run={run} title={c.typing} fig="typingMedianMs" />
        </div>
        <div>
          <h3>{home.costs.costs}</h3>
          <Chart run={run} title={c.cpu} fig="rendererCpuPct" />
          <Chart run={run} title={c.memory} fig="rendererPssGcMb" />
        </div>
      </div>
      <ChartLegend base={home.costs.base} value={home.costs.value} />
      <ul class="ui-notes">
        {home.costs.notes.map((n) => (
          <li key={n}>{rich(n)}</li>
        ))}
      </ul>
      <p>
        <a href="/benchmarks/">{home.costs.benchmarks}</a>
      </p>
    </>
  );
}

/** The landing page, in the order ADR 0002's amendments set. */
function Home({ features, samples, alternatives, benchmarks }: SiteData): VNode {
  return (
    <main class="ui-shell">
      <PageIntro title={home.intro.heading} id="intro" image="home">
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
                <StripItem key={f.id} feature={f} href={`/features/#${f.id}`} />
              ))}
            </ul>
          </nav>
          <p>
            <a href="/features/">{home.strip.all}</a>
          </p>
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
          <Costs run={benchmarks.latest} />
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
          <p>
            <a href="/docs/limits/">{home.limits.more}</a>
          </p>
        </div>
      </section>

      <section class="ui-gutter" id="alternatives" aria-labelledby="alternatives-h">
        <h2 id="alternatives-h">{compared.home.heading}</h2>
        <div class="ui-body">
          <p>{compared.home.intro}</p>
          <AlternativesSummary data={alternatives} />
          <p>
            <a href={`/features/#${compared.features.id}`}>{compared.home.more}</a>
          </p>
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
            <a href="/docs/getting-started/">{home.install.start}</a>
          </p>
          <p>
            <a href="/docs/hosting/">{home.install.guide}</a>
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
  jsonLd: homeData,
  scripts: ['/src/demos/home.ts'],
  render: (data) => <Home {...data} />,
};
