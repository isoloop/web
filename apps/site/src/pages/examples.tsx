/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Example } from '../../build/examples.ts';
import type { Feature } from '../../build/features.ts';
import { examplesPage as t } from '../copy.ts';
import { PageIntro } from './intro.tsx';
import { MeasuredBlock } from './measurements.tsx';
import { rich } from './rich.tsx';
import { StepTabs } from './steps.tsx';
import type { Page, SiteData } from './types.ts';

/** An example's links: live first, then source, results and architecture. */
export function ExampleLinks({ example }: { example: Example }): VNode {
  const { links } = example;
  return (
    <p class="ui-links">
      <a href={links.live}>
        {t.links.live}
        <span class="visually-hidden">: {example.title}</span>
      </a>
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

function Measurements({ example }: { example: Example }): VNode {
  const m = example.measurements;
  return (
    <section class="ex-measurements" aria-labelledby={`${tabId(example)}-m`}>
      <h3 id={`${tabId(example)}-m`}>{t.measurements}</h3>
      {m.status === 'measured' ? (
        m.blocks.map((b) => <MeasuredBlock block={b} more={t.more} key={b.id} />)
      ) : m.status === 'in-progress' ? (
        <div class="ui-callout ex-wip">
          <p>
            <b>{t.inProgress}.</b> {rich(m.note)}
          </p>
          <p>
            <a href={m.previous.href}>{m.previous.label}</a>
          </p>
        </div>
      ) : (
        <p>{rich(m.note)}</p>
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
          <li key={f.id} data-part={f.part}>
            <a href={`/features/#${f.id}`}>
              <b>{f.name}</b> {f.line}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The tab's id in the URL: the app's last folder name (`plant` for dashboards/plant). */
const tabId = (e: Example): string => e.id.split('/').pop() ?? e.id;

function Examples({ examples, features }: SiteData): VNode {
  return (
    <main class="ui-shell">
      <PageIntro title={t.heading}>
        <p class="ui-lede">{t.intro}</p>
        <p>
          <small>{t.support}</small>
        </p>
      </PageIntro>
      <StepTabs
        label={t.nav.label}
        previous={t.nav.previous}
        next={t.nav.next}
        steps={examples.map((e) => ({
          id: tabId(e),
          name: e.tab,
          heading: e.title,
          children: (
            <>
              <ExampleLinks example={e} />
              <div class="ex-text">
                <p>{rich(e.summary)}</p>
              </div>
              <Shot example={e} />
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
              <Measurements example={e} />
            </>
          ),
        }))}
      />
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
