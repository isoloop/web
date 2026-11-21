/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Example } from '../../build/examples.ts';
import type { Feature } from '../../build/features.ts';
import { examplesPage as t } from '../copy.ts';
import { PageIntro } from './intro.tsx';
import { MeasuredBlock } from './measurements.tsx';
import { inline } from './inline.tsx';
import { rich } from './rich.tsx';
import { Pager, RailLayout, type RailGroup } from './steps.tsx';
import { StripItem } from './pill.tsx';
import type { Page, SiteData } from './types.ts';

/** An example's links: live first, then source, results and architecture. */
export function ExampleLinks({ example }: { example: Example }): VNode {
  const { links } = example;
  return (
    <p class="ui-links">
      {/* An example that runs on the hub has no page of its own: its panel is the page. */}
      {example.embeds ? null : (
        <a href={links.live}>
          {t.links.live}
          <span class="visually-hidden">: {example.title}</span>
        </a>
      )}
      <a href={links.source}>
        {t.links.source}
        <span class="visually-hidden"> of {example.title}</span>
      </a>
      {links.results ? (
        <a href={links.results}>
          {t.links.results}
          <span class="visually-hidden"> of {example.title}</span>
        </a>
      ) : null}
      {links.architecture ? (
        <a href={links.architecture}>
          {t.links.architecture}
          <span class="visually-hidden"> of {example.title}</span>
        </a>
      ) : null}
    </p>
  );
}

/**
 * The screenshot, full width, linked to the live example. With a light and a
 * dark one, CSS shows the one for the page's theme (data-theme, set by ui's
 * theme script), so it switches with the theme toggle.
 */
function Shot({ example }: { example: Example }): VNode | null {
  const images = example.images;
  if (!images) return null;
  const alt = `${example.title}, ${t.shot}`;
  const img = (i: NonNullable<Example['images']>['light'], cls?: string): VNode => (
    <img class={cls} src={i.src} alt={alt} width={i.width} height={i.height} loading="lazy" />
  );
  return (
    <a class="ex-shot" href={example.links.live}>
      {images.dark ? (
        <>
          {img(images.light, 'ex-shot-light')}
          {img(images.dark, 'ex-shot-dark')}
        </>
      ) : (
        img(images.light)
      )}
    </a>
  );
}

/**
 * An example that runs on the page, in a frame from load (lazy)
 * with ?embed=1&start=manual: the app draws its working UI and starts nothing.
 * The hub draws Start over it (src/demos/examples.ts), which tells the frame
 * to start (shared/manual-start.ts); leaving the panel reloads it idle. The
 * link above the frame opens the app's own page, with more room. A
 * browser that can't run it gets the app's own notice inside the frame.
 */
function Live({ embed }: { embed: NonNullable<Example['embeds']>[number] }): VNode {
  const src = `${embed.src}?embed=1&start=manual`;
  return (
    <figure class="ex-live" data-live>
      <p class="ex-live-open">
        <a href={embed.src}>
          Open full page →<span class="visually-hidden">: {embed.title}</span>
        </a>
      </p>
      <div class="ex-live-stage">
        {/* oxlint-disable-next-line react/iframe-missing-sandbox -- our own same-origin app: it needs scripts, storage and the hub's messages, which a sandbox would only re-allow */}
        <iframe src={src} title={`${embed.title}, live`} height={embed.height} loading="lazy" />
        <div class="ex-live-cover" hidden>
          <button type="button" class="ui-button" data-strong>
            Start
          </button>
        </div>
      </div>
    </figure>
  );
}

function Measurements({ example }: { example: Example }): VNode {
  const m = example.measurements;
  return (
    <section class="ex-measurements" aria-labelledby={`${tabId(example)}-m`}>
      <h3 id={`${tabId(example)}-m`}>{t.measurements}</h3>
      {m.status === 'measured' ? (
        m.blocks.map((b) => (
          <MeasuredBlock block={b} findings={t.findings} more={t.more} key={b.id} />
        ))
      ) : m.status === 'in-progress' ? (
        <div class="ex-block ex-wip">
          <header class="ex-block-head">
            <h4>{t.inProgress}</h4>
          </header>
          <p>{rich(m.note)}</p>
          <footer class="ex-block-foot">
            <p>
              <a href={m.previous.href}>{m.previous.label}</a>
            </p>
          </footer>
        </div>
      ) : (
        <>
          <p>{rich(m.note)}</p>
          {m.see ? (
            <p>
              <a href={m.see.href}>{m.see.label}</a>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * The features an example shows, as the features strip on the landing page:
 * each feature's name and line, with its part's bar, linked to its section on
 * /features/. An id that isn't a feature fails the build.
 */
function FeatureStrip({
  ids,
  features,
  where,
}: {
  ids: string[];
  features: Feature[];
  where: string;
}): VNode {
  const shown = ids.map((id) => {
    const f = features.find((x) => x.id === id);
    if (!f) throw new Error(`apps/${where}/example.json: shows "${id}", which isn't a feature`);
    return f;
  });
  return (
    <div class="ui-strip">
      <ul>
        {shown.map((f) => (
          <StripItem key={f.id} feature={f} href={`/features/#${f.id}`} />
        ))}
      </ul>
    </div>
  );
}

/** The tab's id in the URL: the app's last folder name (`plant` for dashboards/plant). */
const tabId = (e: Example): string => e.id.split('/').pop() ?? e.id;

type Embed = NonNullable<Example['embeds']>[number];

/** One panel: an example, or one page of an example with several (Processor). */
interface Panel {
  id: string;
  /** Its rail item. */
  name: string;
  heading: string;
  example: Example;
  embed?: Embed | undefined;
  /** Of an example's pages: the first gets what it shows and what to try, the last its measurements. */
  first: boolean;
  last: boolean;
}

function panelsOf(e: Example): Panel[] {
  const embeds = e.embeds ?? [];
  if (embeds.length <= 1)
    return [
      {
        id: tabId(e),
        name: e.tab,
        heading: e.title,
        example: e,
        embed: embeds[0],
        first: true,
        last: true,
      },
    ];
  return embeds.map((x, i) => ({
    id: x.id,
    name: x.title,
    heading: `${e.title}: ${x.title}`,
    example: e,
    embed: x,
    first: i === 0,
    last: i === embeds.length - 1,
  }));
}

function PanelBody({
  p,
  features,
  firstOf,
}: {
  p: Panel;
  features: Feature[];
  firstOf?: Panel | undefined;
}): VNode {
  const e = p.example;
  return (
    <>
      {/* The heading, with the example's links on its line, right-aligned. */}
      <div class="panel-head">
        <h2 class="panel-h" id={`${p.id}-h`}>
          {p.heading}
        </h2>
        <ExampleLinks example={e} />
      </div>
      <div class="ex-text">
        {p.embed?.intro ? (
          // The page's own intro (example.json), as the app draws it too.
          p.embed.intro.map((b) =>
            typeof b === 'string' ? (
              <p key={b}>{inline(b)}</p>
            ) : (
              <ul key={b.list.join('\n')}>
                {b.list.map((li) => (
                  <li key={li}>{inline(li)}</li>
                ))}
              </ul>
            ),
          )
        ) : (
          <p>{rich(e.summary)}</p>
        )}
        {!p.first && firstOf ? (
          <p>
            What it shows and what to try are on <a href={`#${firstOf.id}`}>{firstOf.name}</a>.
          </p>
        ) : null}
      </div>
      {p.embed ? <Live embed={p.embed} /> : <Shot example={e} />}
      {p.first ? (
        <>
          <div class="ex-shows">
            <h3>{t.shows}</h3>
            <FeatureStrip ids={e.shows} features={features} where={e.id} />
          </div>
          <div class="ex-try">
            <h3>{t.try}</h3>
            <ol>
              {e.try.map((x) => (
                <li key={x}>{rich(x)}</li>
              ))}
            </ol>
          </div>
        </>
      ) : null}
      {p.last ? <Measurements example={e} /> : null}
    </>
  );
}

function Examples({ examples, features }: SiteData): VNode {
  // Groups in the order of their first example; a panel per example page.
  const groups: { name: string; panels: Panel[] }[] = [];
  for (const e of examples) {
    const name = e.group ?? e.tab;
    const g = groups.find((x) => x.name === name);
    if (g) g.panels.push(...panelsOf(e));
    else groups.push({ name, panels: panelsOf(e) });
  }
  const panels = groups.flatMap((g) => g.panels);
  const rail: RailGroup[] = groups.map((g) => ({
    title: { href: `#${g.panels[0]!.id}`, text: g.name },
    items: g.panels.map((p) => ({ href: `#${p.id}`, text: p.name })),
  }));
  return (
    <main class="ui-shell">
      <PageIntro title={t.heading}>
        <p class="ui-lede">{t.intro}</p>
        <p>
          <small>{t.support}</small>
        </p>
      </PageIntro>
      <div class="examples-rail">
        <RailLayout label={t.nav.label} groups={rail}>
          {panels.map((p, i) => {
            const prev = panels[i - 1];
            const nxt = panels[i + 1];
            const firstOf = panels.find((x) => x.example === p.example && x.first);
            return (
              <section
                class="ex-section"
                id={p.id}
                aria-labelledby={`${p.id}-h`}
                data-step
                key={p.id}
              >
                <PanelBody p={p} features={features} firstOf={firstOf} />
                <Pager
                  prev={prev ? { href: `#${prev.id}`, text: prev.name } : undefined}
                  next={nxt ? { href: `#${nxt.id}`, text: nxt.name } : undefined}
                  previous={t.nav.previous}
                  nextLabel={t.nav.next}
                  label={t.nav.pager}
                />
              </section>
            );
          })}
        </RailLayout>
      </div>
    </main>
  );
}

export const examplesHubPage: Page = {
  path: '/examples/',
  section: 'examples',
  head: { title: t.title, description: t.description },
  scripts: ['/src/demos/examples.ts'],
  render: (data) => <Examples {...data} />,
};
