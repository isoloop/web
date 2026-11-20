/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { ExperimentalMark } from 'ui/components';
import type { Doc } from '../../build/docs/pages.ts';
import { LIBRARY_GITHUB } from '../../build/docs/links.ts';
import { mdPath } from '../../build/docs/llms.ts';
import { docsPage as c, marks } from '../copy.ts';
import type { Page, SiteData } from './types.ts';

// The docs layout (isoloop/isoloop M4c task 11, from the approved mock; ADR
// 0006): a section sidebar, the guide, and its contents on the right. Below
// 1100px the contents fold under the page's meta line, and below 760px the
// sidebar folds into a "Docs" block at the top, both as <details>, so the
// pages read and navigate without JS. The only script is the code blocks'
// Copy button (src/demos/copy.ts).

const COPY_SCRIPT = '/src/demos/copy.ts';

/** The docs in their manifest sections, in order. */
function sections(docs: readonly Doc[]): { title: string; docs: Doc[] }[] {
  const out: { title: string; docs: Doc[] }[] = [];
  for (const d of docs) {
    const last = out.at(-1);
    if (last?.title === d.section) last.docs.push(d);
    else out.push({ title: d.section, docs: [d] });
  }
  return out;
}

/** A section's anchor on /docs/, e.g. `agents-and-tooling`. */
const sectionId = (title: string): string => title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function Pill({ doc }: { doc: Doc }): VNode | null {
  return doc.experimental ? <span class="ui-pill">{marks.experimental}</span> : null;
}

/** The section sidebar; `current` marks this page. */
function SideNav({ docs, current }: { docs: readonly Doc[]; current?: string }): VNode {
  return (
    <nav class="docs-side" aria-label={c.nav}>
      {sections(docs).map((s) => (
        <div key={s.title}>
          <h2>{s.title}</h2>
          <ul>
            {s.docs.map((d) => (
              <li key={d.slug}>
                <a href={d.path} aria-current={d.slug === current ? 'page' : undefined}>
                  {d.experimental ? (
                    <MarkedTitle title={d.title} label={marks.experimental} />
                  ) : (
                    d.title
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** The page's h2s, for "On this page". */
function Contents({ doc }: { doc: Doc }): VNode | null {
  const h2 = doc.headings.filter((h) => h.depth === 2);
  if (!h2.length) return null;
  return (
    <ul>
      {h2.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`}>{h.text}</a>
        </li>
      ))}
    </ul>
  );
}

function DocArticle({ doc, data }: { doc: Doc; data: SiteData }): VNode {
  const i = data.docs.findIndex((d) => d.slug === doc.slug);
  const prev = i > 0 ? data.docs[i - 1] : undefined;
  const next = i >= 0 ? data.docs[i + 1] : undefined;
  const source = `${LIBRARY_GITHUB}/blob/${data.pin}/${doc.source}`;
  const hasContents = doc.headings.some((h) => h.depth === 2);
  return (
    <div class="docs-layout">
      <div class="docs-only-wide">
        <SideNav docs={data.docs} current={doc.slug} />
      </div>
      <main class="docs-article">
        <details class="docs-fold docs-only-narrow">
          <summary>
            {c.docs}{' '}
            <span>
              {doc.section} · {doc.title}
            </span>
          </summary>
          <SideNav docs={data.docs} current={doc.slug} />
        </details>
        <p class="docs-crumb">
          <a href="/docs/">{c.docs}</a> · {doc.section}
        </p>
        <h1>
          {doc.title}
          <Pill doc={doc} />
        </h1>
        {/* Rendered from the pinned guide by renderMarkdown(), which escapes the source's HTML. */}
        {/* oxlint-disable-next-line react/no-danger -- build-time HTML from renderMarkdown (html: false), never user input */}
        <p class="docs-lead" dangerouslySetInnerHTML={{ __html: doc.leadHtml }} />
        <p class="docs-meta">
          <a href={source}>{c.source}</a>
          <a href={mdPath(doc.slug)}>{c.markdown}</a>
          <span>{c.version(data.libraryVersion)}</span>
        </p>
        {hasContents ? (
          <details class="docs-fold docs-toc-fold">
            <summary>{c.onThisPage}</summary>
            <div class="docs-toc">
              <Contents doc={doc} />
            </div>
          </details>
        ) : null}
        {/* oxlint-disable-next-line react/no-danger -- build-time HTML from renderMarkdown (html: false), never user input */}
        <article class="doc" dangerouslySetInnerHTML={{ __html: doc.body }} />
        {prev || next ? (
          <nav class="docs-pager" aria-label={`${c.previous} and ${c.next.toLowerCase()}`}>
            {prev ? (
              <a href={prev.path} rel="prev">
                <span>{c.previous}</span>
                <b>{prev.title}</b>
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a href={next.path} rel="next" class="next">
                <span>{c.next}</span>
                <b>{next.title}</b>
              </a>
            ) : null}
          </nav>
        ) : null}
      </main>
      {hasContents ? (
        <aside class="docs-toc docs-only-widest" aria-label={c.onThisPage}>
          <b>{c.onThisPage}</b>
          <Contents doc={doc} />
          <p class="docs-toc-foot">
            <a href={source}>{c.source}</a>
            <a href={mdPath(doc.slug)}>{c.markdown}</a>
          </p>
        </aside>
      ) : null}
    </div>
  );
}

/** The page for one guide. */
/** The title with the mark kept on the last word's line, so a wrapped title ends in it. */
function MarkedTitle({ title, label }: { title: string; label: string }): VNode {
  const cut = title.lastIndexOf(' ') + 1;
  return (
    <>
      {title.slice(0, cut)}
      <span class="docs-side-last">
        {title.slice(cut)}
        <ExperimentalMark label={label} />
      </span>
    </>
  );
}

export function docPage(doc: Doc): Page {
  return {
    path: doc.path,
    section: 'docs',
    head: { title: doc.title, description: doc.description },
    scripts: [COPY_SCRIPT],
    render: (data: SiteData) => <DocArticle doc={doc} data={data} />,
  };
}

/** /docs/: every section and its pages, with each page's one-sentence description. */
export const docsIndexPage: Page = {
  path: '/docs/',
  section: 'docs',
  head: { title: c.title, description: c.description },
  render: (data: SiteData) => (
    <div class="docs-layout docs-layout-index">
      <div class="docs-only-wide">
        <SideNav docs={data.docs} />
      </div>
      <main class="docs-article">
        <h1>{c.heading}</h1>
        <p class="docs-lead">{c.lede}</p>
        <p class="docs-meta">
          <span>{c.version(data.libraryVersion)}</span>
        </p>
        {sections(data.docs).map((s) => (
          <section class="docs-index-section" key={s.title} aria-labelledby={sectionId(s.title)}>
            <h2 id={sectionId(s.title)}>{s.title}</h2>
            <ul>
              {s.docs.map((d) => (
                <li key={d.slug}>
                  <a href={d.path}>
                    <b>{d.title}</b>
                    <Pill doc={d} />
                  </a>{' '}
                  {d.description}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  ),
};
