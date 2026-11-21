// The examples hub's data (ADR 0002, decision 5): one example.json per app,
// validated at build time. A bad or missing file fails the build with an error
// naming the file and the field. A new example joins the hub by adding its
// example.json in the same PR as the app, or later, marked `draft` until then.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';

const rootPath = z
  .string()
  .regex(/^\/[^\s]*$/, 'a root-absolute path on the site, starting with /');
const https = z.url({ protocol: /^https$/, error: 'an https URL' });

const tag = z
  .string()
  .regex(/^[a-z]+-v\d+\.\d+\.\d+(-[0-9a-z.]+)?$/, 'a release tag, e.g. plant-v0.1.0');
const webp = z.string().regex(/^[a-z0-9-]+\.webp$/, 'a .webp file name next to example.json');
const text = z.string().min(1);

/** Δ's verdict, in words beside the value, so colour isn't the only cue. */
export const verdictSchema = z.enum(['better', 'worse', 'same']);
/** One pair's cells in a row: A, B, and the Δ with its verdict (none for counts). */
const cellsSchema = z.union([
  z.tuple([text, text]),
  z.tuple([text, text, z.tuple([text, verdictSchema])]),
]);

/**
 * One measured comparison, as the A/B/Δ table the landing page uses: the
 * findings first, then the table (results pages: findings, then tables). The
 * cells are copied from the run's summary as written; Δ is the median of the
 * per-round gaps, so it can't be computed from A and B.
 */
export const blockSchema = z
  .strictObject({
    /** Stable, for pages that show one block elsewhere (the landing's costs: plant `desktop`). */
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'a lowercase id, e.g. desktop'),
    heading: text,
    findings: z.array(text).min(1),
    /** Device, browser, rounds and date: what the figures were measured on. */
    caption: text,
    /** The release the figures ship with. */
    tag,
    /** The table; a block of findings alone has neither (runs recorded by hand, in one round). */
    pairs: z
      .array(z.strictObject({ a: text, b: text, label: text }))
      .min(1)
      .optional(),
    groups: z
      .array(
        z.strictObject({
          heading: text,
          rows: z.array(z.strictObject({ label: text, cells: z.array(cellsSchema) })).min(1),
        }),
      )
      .min(1)
      .optional(),
    /** The other engine, in words: the tables show one. */
    firefox: text.optional(),
    notes: z.array(text).optional(),
    /** The run's own write-up. */
    results: https,
  })
  .superRefine((b, ctx) => {
    if (!b.pairs !== !b.groups) {
      ctx.addIssue({ code: 'custom', message: 'a table needs both pairs and groups' });
      return;
    }
    for (const g of b.groups ?? []) {
      for (const r of g.rows) {
        if (r.cells.length !== (b.pairs ?? []).length) {
          ctx.addIssue({
            code: 'custom',
            message: `row "${r.label}" has ${String(r.cells.length)} cells for ${String((b.pairs ?? []).length)} pairs`,
          });
        }
      }
    }
  });

export const exampleSchema = z.strictObject({
  title: z.string().min(1),
  /** Its tab's short name on /examples/, e.g. Plant. */
  tab: text,
  /** What the example is, in a short paragraph. */
  summary: z.string().min(1),
  /** The features it demonstrates, by id in apps/site/content/features/, shown as the features strip. */
  shows: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/, 'a feature id, e.g. containment')).min(1),
  /** Concrete things to do in it, and what to watch. */
  try: z.array(text).min(1),
  /** Where it sits on the hub; lower first. */
  order: z.number().int().optional(),
  /** Its group in the hub's rail, e.g. Dashboards; the example's own name if none. */
  group: text.optional(),
  /**
   * The pages that run live on the hub, idle until Start: each a same-origin
   * page, framed with ?embed=1&start=manual at a fixed height. Without it the
   * hub shows the screenshot only.
   */
  embeds: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'a lowercase id, e.g. playground'),
        title: text,
        src: rootPath,
        height: z.number().int().min(200).max(2000),
        /**
         * The page's intro, drawn by the page itself and by the hub's panel
         * (shared/intro.ts): paragraphs, or `{ list }`; text marks `code` and
         * **bold**. The panel shows it instead of the summary.
         */
        intro: z
          .array(z.union([text, z.strictObject({ list: z.array(text).min(1) })]))
          .min(1)
          .optional(),
      }),
    )
    .min(1)
    .optional(),
  /**
   * Measured comparisons; or a run in progress, with the previous one linked;
   * or none, with why.
   */
  measurements: z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('measured'), blocks: z.array(blockSchema).min(1) }),
    z.strictObject({
      status: z.literal('in-progress'),
      note: text,
      previous: z.strictObject({ href: https, label: text }),
    }),
    z.strictObject({
      status: z.literal('none'),
      note: text,
      /** Where the figures are instead: another tab (`#plant`) or a page. */
      see: z
        .strictObject({
          href: z.string().regex(/^(#|\/)[^\s]*$/, 'a #tab or a root path'),
          label: text,
        })
        .optional(),
    }),
  ]),
  links: z.strictObject({
    live: rootPath,
    source: https,
    results: https.optional(),
    architecture: rootPath.optional(),
  }),
  /**
   * Built and tested in CI but not deployed yet: the hub leaves it out until
   * the app is assembled into the site (scripts/assemble-site.sh), so the hub
   * never links to a page that isn't there.
   */
  draft: z.literal(true).optional(),
  /**
   * WebPs next to example.json, written by `pnpm screenshots`: one per theme,
   * or one for an app that looks the same in both.
   */
  screenshot: z.strictObject({ light: webp, dark: webp.optional() }).optional(),
});

export type ExampleJson = z.infer<typeof exampleSchema>;
export type Block = z.infer<typeof blockSchema>;

export interface Example extends ExampleJson {
  /** The app's path below apps/, e.g. `dashboards/plant`. */
  id: string;
  /** The screenshots as served, with their size, if there are any. */
  images?: { light: Image; dark?: Image };
}

export interface Image {
  src: string;
  file: string;
  width: number;
  height: number;
}

/** An example's screenshots, light first. */
export function imagesOf(e: Example): Image[] {
  if (!e.images) return [];
  return e.images.dark ? [e.images.light, e.images.dark] : [e.images.light];
}

/** Width and height from a WebP file's header (VP8, VP8L or VP8X). */
export function webpSize(bytes: Uint8Array): { width: number; height: number } {
  const ascii = (at: number, n: number): string =>
    String.fromCharCode(...bytes.subarray(at, at + n));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') throw new Error('not a WebP file');
  const chunk = ascii(12, 4);
  const u16 = (at: number): number => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
  const u24 = (at: number): number => u16(at) | ((bytes[at + 2] ?? 0) << 16);
  if (chunk === 'VP8X') return { width: u24(24) + 1, height: u24(27) + 1 };
  if (chunk === 'VP8 ') return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b = (i: number): number => bytes[21 + i] ?? 0;
    const width = 1 + (((b(1) & 0x3f) << 8) | b(0));
    const height = 1 + (((b(3) & 0x0f) << 10) | (b(2) << 2) | ((b(1) & 0xc0) >> 6));
    return { width, height };
  }
  throw new Error(`unknown WebP chunk ${chunk}`);
}

/** Every folder under apps/ that holds a package.json, as paths below apps/. */
function appDirs(appsDir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(appsDir, prefix)).toSorted()) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    const dir = join(appsDir, rel);
    if (!statSync(dir).isDirectory()) continue;
    if (existsSync(join(dir, 'package.json'))) out.push(rel);
    else out.push(...appDirs(appsDir, rel));
  }
  return out;
}

/** The hub's examples, validated, in hub order. The site and its code samples aren't examples. */
export function loadExamples(repoRoot: string): Example[] {
  const appsDir = join(repoRoot, 'apps');
  const examples: Example[] = [];
  for (const id of appDirs(appsDir)) {
    if (id === 'site' || id === 'samples') continue;
    const file = join(appsDir, id, 'example.json');
    const where = relative(repoRoot, file);
    if (!existsSync(file)) throw new Error(`${where} is missing: every app needs one for the hub`);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`${where}: not valid JSON (${e instanceof Error ? e.message : String(e)})`, {
        cause: e,
      });
    }
    const parsed = exampleSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  ${i.path.join('.') || '(top level)'}: ${i.message}`)
        .join('\n');
      throw new Error(`${where} is invalid:\n${issues}`);
    }
    if (parsed.data.draft) continue;
    const example: Example = { ...parsed.data, id };
    if (parsed.data.screenshot) {
      const image = (name: string, theme: string): Image => {
        const shot = join(appsDir, id, name);
        if (!existsSync(shot)) throw new Error(`${where}: screenshot ${name} doesn't exist`);
        const src = `/examples/img/${id.replace(/\//g, '-')}-${theme}.webp`;
        return { src, file: shot, ...webpSize(readFileSync(shot)) };
      };
      const { light, dark } = parsed.data.screenshot;
      example.images = dark
        ? { light: image(light, 'light'), dark: image(dark, 'dark') }
        : { light: image(light, 'light') };
    }
    examples.push(example);
  }
  return examples.toSorted(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title),
  );
}
