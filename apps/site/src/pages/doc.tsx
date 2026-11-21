/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { ExperimentalMark } from 'ui/components';
import { mdPath } from '../../build/docs/llms.ts';
import type { Doc, NavItem, NavSection } from '../../build/docs/pages.ts';
import { docsPage as c, marks } from '../copy.ts';
import type { Page, SiteData } from './types.ts';

// The docs layout (isoloop/isoloop M4c task 11, from the approved mock; ADR
// 0006): a section sidebar, the guide, and its contents on the right. Below
// 1100px the contents fold under the page's meta line, and below 760px the
// sidebar folds into a "Docs" block at the top, both as <details>, so the
// pages read and navigate without JS. The scripts are the code blocks' Copy
// button (src/demos/copy.ts), "On this page" marking the heading in view
// (src/demos/spy.ts) and the search (src/demos/search.ts), all from
// src/demos/docs.ts.

const COPY_SCRIPT = '/src/demos/docs.ts';

/** A section's anchor on /docs/, e.g. `agents-and-tooling`. */
const sectionId = (title: string): string => title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function Pill({ doc }: { doc: { experimental: boolean } }): VNode | null {
  return doc.experimental ? <span class="ui-pill">{marks.experimental}</span> : null;
}

/** The section sidebar; `current` marks this page. Links into a page (Kernel config) are never current. */
/**
 * The docs' search (src/demos/search.ts): an ARIA combobox over a listbox of
 * results. Rendered hidden and shown by the script, since without JS there's
 * nothing to search with: the site has no server. `id` keeps the two copies
 * on a page (the sidebar's and the folded one's) apart.
 */
function SearchBox({ id, class: extra }: { id: string; class?: string }): VNode {
  return (
    <div class={extra ? `docs-search ${extra}` : 'docs-search'} data-search hidden>
      <label class="ui-sr-only" for={`${id}-q`}>
        {c.search.label}
      </label>
      <svg class="docs-search-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path
          d="M10.6 10.6 14 14"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      <input
        id={`${id}-q`}
        type="search"
        // Preact's types ask a combobox input for a list attribute; the ARIA
        // pattern here (a listbox in aria-controls) doesn't use one.
        {...({ role: 'combobox' } as Record<string, string>)}
        aria-expanded="false"
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck={false}
        placeholder={c.search.placeholder}
      />
      <kbd class="docs-search-kbd" aria-hidden="true">
        {c.search.key}
      </kbd>
      <div class="docs-search-panel" hidden>
        <ul id={`${id}-list`} role="listbox" aria-label={c.search.results} />
        <p class="docs-search-empty" role="status" aria-live="polite" />
      </div>
    </div>
  );
}

function SideNav({
  nav,
  current,
  search,
}: {
  nav: readonly NavSection[];
  current?: string;
  /** The search box's id prefix: each copy of the sidebar has its own. */
  search: string;
}): VNode {
  return (
    <nav class="docs-side" aria-label={c.nav}>
      <SearchBox id={search} />
      {nav.map((s) => (
        <div key={s.title}>
          <h2>{s.title}</h2>
          <ul>
            {s.items.map((d: NavItem) => (
              <li key={d.path}>
                <a
                  href={d.path}
                  aria-current={d.slug !== undefined && d.slug === current ? 'page' : undefined}
                >
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

/** The page's h2s, for "On this page"; on an API page, each entry point's exports (h3) under it. */
function Contents({ doc }: { doc: Doc }): VNode | null {
  const h2 = doc.headings.filter((h) => h.depth === 2);
  if (!h2.length) return null;
  const under = (i: number) => {
    const at = doc.headings.indexOf(h2[i]!);
    const end = i + 1 < h2.length ? doc.headings.indexOf(h2[i + 1]!) : doc.headings.length;
    return doc.headings.slice(at + 1, end).filter((h) => h.depth === 3);
  };
  return (
    <ul>
      {h2.map((h, i) => (
        <li key={h.id}>
          <a href={`#${h.id}`}>{h.text}</a>
          {doc.kind === 'api' && under(i).length ? (
            <ul>
              {under(i).map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`}>{x.text}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DocArticle({ doc, data }: { doc: Doc; data: SiteData }): VNode {
  const i = data.docs.findIndex((d) => d.slug === doc.slug);
  const prev = i > 0 ? data.docs[i - 1] : undefined;
  const next = i >= 0 ? data.docs[i + 1] : undefined;
  const hasContents = doc.headings.some((h) => h.depth === 2);
  return (
    <div class="docs-layout">
      <div class="docs-only-wide">
        <SideNav nav={data.docsNav} current={doc.slug} search="search-side" />
      </div>
      <main class="docs-article">
        <details class="docs-fold docs-only-narrow">
          <summary>
            {c.docs}{' '}
            <span>
              {doc.section} · {doc.title}
            </span>
          </summary>
          <SideNav nav={data.docsNav} current={doc.slug} search="search-fold" />
        </details>
        <p class="docs-crumb">
          <span>
            <a href="/docs/">{c.docs}</a> · {doc.section}
          </span>
          <a class="docs-md" href={mdPath(doc.slug)}>
            {c.markdown}
          </a>
        </p>
        <h1>
          {doc.title}
          <Pill doc={doc} />
        </h1>
        {/* Rendered from the pinned guide by renderMarkdown(), which escapes the source's HTML. */}
        {/* oxlint-disable-next-line react/no-danger -- build-time HTML from renderMarkdown (html: false), never user input */}
        <p class="docs-lead" dangerouslySetInnerHTML={{ __html: doc.leadHtml }} />
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
  scripts: ['/src/demos/search.ts'],
  render: (data: SiteData) => (
    <div class="docs-layout docs-layout-index">
      <div class="docs-only-wide">
        <SideNav nav={data.docsNav} search="search-side" />
      </div>
      <main class="docs-article">
        <SearchBox id="search-top" class="docs-only-narrow" />
        <h1>{c.heading}</h1>
        <p class="docs-lead">{c.lede}</p>
        <p class="docs-agents">
          {c.agents.lead} <a href="/llms.txt">{c.agents.index}</a> {c.agents.indexNote}{' '}
          <a href="/llms-full.txt">{c.agents.full}</a> {c.agents.fullNote}
        </p>
        {data.docsNav.map((s) => (
          <section class="docs-index-section" key={s.title} aria-labelledby={sectionId(s.title)}>
            <h2 id={sectionId(s.title)}>{s.title}</h2>
            <ul>
              {s.items.map((d) => (
                <li key={d.path}>
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
