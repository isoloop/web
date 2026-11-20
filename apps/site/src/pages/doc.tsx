/** @jsxImportSource preact */
import type { VNode } from 'preact';
import type { Doc } from '../../build/docs/pages.ts';
import { LIBRARY_GITHUB } from '../../build/docs/links.ts';
import type { Page, SiteData } from './types.ts';

/**
 * One guide's page at /docs/<slug>/: its Markdown rendered at build time
 * (build/docs/pages.ts), plainly. The docs layout (section sidebar, table of
 * contents, the index page and "Docs" in the header) comes with M4c task 11,
 * after the design mock; until then these pages aren't linked from the header
 * or listed in the sitemap.
 */
function DocArticle({ doc, pin }: { doc: Doc; pin: string }): VNode {
  return (
    <main class="ui-shell">
      <section class="ui-gutter doc-page" aria-label={doc.title}>
        <p class="doc-section">Docs · {doc.section}</p>
        {/* Rendered from the pinned guide by renderMarkdown(), which escapes the source's HTML. */}
        {/* oxlint-disable-next-line react/no-danger -- build-time HTML from renderMarkdown (html: false), never user input */}
        <article class="ui-body doc" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <p class="doc-source">
          From <a href={`${LIBRARY_GITHUB}/blob/${pin}/${doc.source}`}>{doc.source}</a> in
          isoloop/isoloop at <code>{pin.slice(0, 7)}</code>.
        </p>
      </section>
    </main>
  );
}

/** The page for one guide. */
export function docPage(doc: Doc): Page {
  return {
    path: doc.path,
    head: { title: doc.title, description: doc.description },
    render: (data: SiteData) => <DocArticle doc={doc} pin={data.pin} />,
  };
}
