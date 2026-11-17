/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Block, Entry } from '../../build/changelog.ts';
import { changelogPage as c } from '../copy.ts';
import { inline } from './inline.tsx';
import { PageIntro } from './intro.tsx';
import type { Page, SiteData } from './types.ts';

const WEB_TAGS = 'https://github.com/isoloop/web/tags';

function Blocks({ blocks }: { blocks: Block[] }): VNode {
  return (
    <>
      {blocks.map((b) =>
        b.kind === 'p' ? (
          <p key={b.text}>{inline(b.text)}</p>
        ) : (
          <ul key={b.items.join('\n')}>
            {b.items.map((item) => (
              <li key={item}>{inline(item)}</li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

/** One release's entries, each labelled with its package or app and its kind. */
function Entries({ entries }: { entries: Entry[] }): VNode {
  return (
    <ul class="changes">
      {entries.map((e) => (
        <li key={`${e.source}:${JSON.stringify(e.blocks)}`}>
          <p class="change-source">
            <b>{e.source}</b>
            {e.kind ? <span> · {e.kind.replace(/ Changes$/, '').toLowerCase()}</span> : null}
          </p>
          <Blocks blocks={e.blocks} />
        </li>
      ))}
    </ul>
  );
}

function Changelog({ changelog }: SiteData): VNode {
  return (
    <main class="ui-shell">
      <PageIntro title={c.heading}>
        <p class="ui-lede">{c.lede}</p>
      </PageIntro>

      <section class="ui-gutter" id="library" aria-labelledby="library-h">
        <h2 id="library-h">{c.library.heading}</h2>
        <div class="ui-body">
          {changelog.library.length === 0 ? (
            <>
              <p>{c.library.unreleased}</p>
              <p>
                {c.library.packages} {changelog.libraryUnreleased.join(', ')}.
              </p>
            </>
          ) : (
            changelog.library.map((r) => (
              <section class="release" key={r.version} aria-labelledby={`lib-${r.version}`}>
                <h3 id={`lib-${r.version}`}>{r.version}</h3>
                <Entries entries={r.entries} />
              </section>
            ))
          )}
        </div>
      </section>

      <section class="ui-gutter" id="apps" aria-labelledby="apps-h">
        <h2 id="apps-h">{c.apps.heading}</h2>
        <div class="ui-body">
          {changelog.apps.map((r) => (
            <section class="release" key={r.tag} aria-labelledby={`tag-${r.tag}`}>
              <h3 id={`tag-${r.tag}`}>
                {r.tag}
                {r.date ? <span class="release-date"> · {r.date}</span> : null}
              </h3>
              <Entries entries={r.entries} />
            </section>
          ))}
          {changelog.appsUnreleased.length > 0 ? (
            <p>
              {c.apps.unreleased} {changelog.appsUnreleased.join(', ')} (
              <a href={WEB_TAGS}>{c.apps.tags}</a>).
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export const changelogPage: Page = {
  path: '/changelog/',
  head: { title: c.title, description: c.description },
  render: (data) => <Changelog {...data} />,
};
