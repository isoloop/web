// Isoloop and the alternatives, as data: content/alternatives.json, for the
// home page's table and the Compared tab on /features/. Validated at build
// time. Every cell names its source, that project's own docs (or ours for
// Isoloop's row), and the date it was checked.
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a date, YYYY-MM-DD');
/** A page on this site (`/docs/…`) or an https URL. */
const link = z.string().regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, 'a site path or an https URL');
const sentence = z.string().regex(/^\S[\s\S]*[.!?]$/, 'one or more sentences, with the full stop');

const text = z.strictObject({
  note: sentence,
  source: link,
  checked: date,
});
const mark = text.extend({ mark: z.enum(['yes', 'partial', 'no']) });

/** The columns: the four with marks first, then the two in words. */
export const MARK_COLUMNS = ['ui', 'supervision', 'bus', 'security'] as const;
export const TEXT_COLUMNS = ['browsers', 'cost'] as const;

const row = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** The name, `backticks` set as code. */
  name: z.string().min(1),
  /** Its home page or docs. */
  url: link,
  /** Where it's the better choice than Isoloop; absent on Isoloop's own row. */
  betterFor: sentence.optional(),
  ui: mark,
  supervision: mark,
  bus: mark,
  security: mark,
  browsers: text,
  cost: text,
});

export const alternativesSchema = z
  .strictObject({
    $comment: z.string().optional(),
    columns: z.strictObject({
      ui: z.string().min(1),
      supervision: z.string().min(1),
      bus: z.string().min(1),
      security: z.string().min(1),
      browsers: z.string().min(1),
      cost: z.string().min(1),
    }),
    rows: z.array(row).min(2),
  })
  .refine((a) => a.rows[0]?.id === 'isoloop', 'Isoloop is the first row')
  .refine(
    (a) => a.rows.slice(1).every((r) => r.betterFor),
    'every alternative says where it is the better choice',
  )
  .refine((a) => a.rows[0]?.betterFor === undefined, "Isoloop's row has no betterFor")
  .refine((a) => new Set(a.rows.map((r) => r.id)).size === a.rows.length, 'row ids are unique');

export type Alternatives = z.infer<typeof alternativesSchema>;
export type Alternative = Alternatives['rows'][number];

/** Reads and checks content/alternatives.json; throws listing every problem. */
export function loadAlternatives(file: string): Alternatives {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`apps/site/content/alternatives.json: not valid JSON (${String(err)})`, {
      cause: err,
    });
  }
  const parsed = alternativesSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(`apps/site/content/alternatives.json:\n- ${problems.join('\n- ')}`);
  }
  return parsed.data;
}
