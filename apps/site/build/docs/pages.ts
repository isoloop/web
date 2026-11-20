// The docs pages (M4c, decisions 9–11; ADR 0006): the library's guides,
// fetched at the pin (build/library.ts), listed and ordered by
// content/docs.json, and rendered through renderMarkdown().
//
// The manifest and the fetched guides must match exactly: a guide at the pin
// that docs.json doesn't list fails the build, and so does a listed guide the
// pin doesn't have. A planned guide is listed when the pin first has it, in the
// PR that moves the pin (the docs skill's "add a guide" step).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { highlight } from './highlight.ts';
import { GUIDES_PATH, rewriteLink, type LinkContext } from './links.ts';
import { DocError, renderMarkdown, type DocHeading } from './render.ts';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'a guide slug, e.g. getting-started');

export const manifestSchema = z.strictObject({
  $comment: z.string().optional(),
  sections: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        guides: z
          .array(
            z.strictObject({
              slug,
              /**
               * The guide was written before the one-sentence lead rule and is
               * waiting to be reshaped (isoloop/isoloop M4c task 5): its
               * description is its lead's first sentence. The build fails once
               * the guide no longer needs it, so the mark can't outstay it.
               */
              leadPending: z.literal(true).optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type DocsManifest = z.infer<typeof manifestSchema>;

/** One guide's page on the site. */
export interface Doc {
  slug: string;
  /** Its section in the manifest, e.g. "Build". */
  section: string;
  /** `/docs/<slug>/`. */
  path: string;
  title: string;
  description: string;
  html: string;
  headings: DocHeading[];
  /** The guide's path in the library, for the "source" link. */
  source: string;
}

/** Reads and validates docs.json; the error names the file and the field. */
export function readManifest(file: string): DocsManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: not valid JSON (${e instanceof Error ? e.message : String(e)})`, {
      cause: e,
    });
  }
  const r = manifestSchema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new Error(`${file}: ${issue?.path.join('.') || '(root)'}: ${issue?.message}`);
  }
  const seen = new Set<string>();
  for (const g of r.data.sections.flatMap((s) => s.guides)) {
    if (seen.has(g.slug)) throw new Error(`${file}: "${g.slug}" is listed twice`);
    seen.add(g.slug);
  }
  return r.data;
}

/** Checks the manifest against the guides at the pin, both ways. */
export function matchGuides(
  manifest: DocsManifest,
  fetched: readonly string[],
  file: string,
): void {
  const listed = new Set(manifest.sections.flatMap((s) => s.guides.map((g) => g.slug)));
  const have = new Set(fetched);
  const unlisted = [...have].filter((s) => !listed.has(s));
  const missing = [...listed].filter((s) => !have.has(s));
  const problems = [
    ...unlisted.map(
      (s) => `${GUIDES_PATH}/${s}.md is at the pin but not in ${file}; add it to a section`,
    ),
    ...missing.map((s) => `${file} lists "${s}", but the pin has no ${GUIDES_PATH}/${s}.md`),
  ];
  if (problems.length) throw new Error(problems.join('\n'));
}

export interface LoadDocsOptions {
  /** content/docs.json. */
  manifest: string;
  /** The pinned docs/guide folder (guidesDir in build/library.ts). */
  guidesDir: string;
  pin: string;
  /** What's at a library path at the pin (for links to ADRs, source and the rest). */
  kind: LinkContext['kind'];
}

/** Every docs page, in manifest order. Throws on any rule the docs break. */
export function loadDocs(o: LoadDocsOptions): Doc[] {
  const manifest = readManifest(o.manifest);
  const fetched = readdirSync(o.guidesDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
  const file = relative(process.cwd(), o.manifest) || o.manifest;
  matchGuides(manifest, fetched, file);
  const guides = new Set(fetched);

  return manifest.sections.flatMap((section) =>
    section.guides.map((g): Doc => {
      const source = `${GUIDES_PATH}/${g.slug}.md`;
      // Guides checked out on a machine with core.autocrlf may have CRLF ends.
      const src = readFileSync(join(o.guidesDir, `${g.slug}.md`), 'utf8').replace(/\r\n/g, '\n');
      const ctx: LinkContext = { file: source, pin: o.pin, guides, kind: o.kind };
      const doc = renderMarkdown(src, {
        file: source,
        highlight,
        rewrite: (href, kind) => rewriteLink(href, kind, ctx),
        lead: g.leadPending ? 'first-sentence' : 'strict',
      });
      if (g.leadPending) {
        let strict = true;
        try {
          renderMarkdown(src, { file: source });
        } catch (e) {
          if (!(e instanceof DocError)) throw e;
          strict = false;
        }
        if (strict) {
          throw new Error(
            `${file}: "${g.slug}" is marked leadPending, but its lead is one sentence now; remove the mark`,
          );
        }
      }
      return {
        slug: g.slug,
        section: section.title,
        path: `/docs/${g.slug}/`,
        title: doc.title,
        description: doc.description,
        html: doc.html,
        headings: doc.headings,
        source,
      };
    }),
  );
}
