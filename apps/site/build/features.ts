// The features on /features/ and the landing strip, as data (ADR 0004,
// decision 5): one content/features/<id>.json per feature, validated at build
// time. Each entry carries proof links to the code or tests that back its
// claims, and the drift guard fails the build when one no longer exists: at the
// library pin for isoloop/isoloop proofs, in this checkout for isoloop/web ones.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { LibraryReader } from './library.ts';

const proofSchema = z
  .strictObject({
    repo: z.enum(['isoloop', 'web']),
    /** A file or folder, relative to the repo's root. */
    path: z.string().regex(/^[^/\s][^\s]*$/, 'a path relative to the repo root'),
    /** An export the file must declare. */
    symbol: z
      .string()
      .regex(/^[A-Za-z_$][\w$]*$/, 'an identifier')
      .optional(),
    /** A test title the file must contain. */
    test: z.string().min(1).optional(),
  })
  .refine((p) => !(p.symbol && p.test), 'a proof names a symbol or a test, not both');

export const featureSchema = z.strictObject({
  /** The anchor on /features/, and the file name. */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  /** Its place on /features/ and in the strip; lower first. */
  order: z.number().int(),
  /** The part of the system it's about, which sets its colour (ADR 0003). */
  part: z.enum(['isolate', 'bus', 'pool', 'host', 'cost']),
  /** Its tab on /features/ (ADR 0005); the tabs and their order are in src/pages/features.tsx. */
  tab: z.enum(['isolation', 'bus', 'placement', 'tools', 'safety', 'cost']),
  /**
   * Where it sits on the blueprint that opens /features/ (ADR 0005): the part
   * of the system it runs in, or the cost line along the bottom.
   */
  blueprint: z.enum(['host', 'bus', 'isolate', 'pool', 'devtools', 'cost']),
  /** The strip's lead, with its full stop; the section heading drops the stop. */
  name: z.string().regex(/\.$/, 'ends with a full stop'),
  /** Marked with the Experimental pill wherever its name shows (ADR 0005). */
  experimental: z.boolean().optional(),
  /** The strip's line. */
  line: z.string().min(1),
  /** The section's paragraphs, `backticks` set as code. Empty where the section is all figures. */
  text: z.array(z.string().min(1)),
  /** Which figure or demo the section shows (src/pages/features.tsx). */
  demo: z.enum([
    'recording',
    'restart-still',
    'bus',
    'replay',
    'durable-still',
    'placement-still',
    'balancer-table',
    'agents-code',
    'devtools-code',
    'framework-tabs',
    'safety-facts',
    'cost-table',
  ]),
  /**
   * The release that first shipped or showed it: a library version once the
   * library has releases, else the site tag that first showed it.
   */
  since: z.string().regex(/^([a-z]+-v)?\d+\.\d+\.\d+(-[0-9a-z.]+)?$/, 'a version or a release tag'),
  /** The code or tests that back the claims. */
  proof: z.array(proofSchema).min(1),
});

export type Feature = z.infer<typeof featureSchema>;
type Proof = Feature['proof'][number];

/** Does `source` export `symbol`, as a declaration or in an export list? */
export function exportsSymbol(source: string, symbol: string): boolean {
  const name = symbol.replace(/\$/g, '\\$');
  const declared = new RegExp(
    `\\bexport\\s+(?:declare\\s+)?(?:default\\s+)?(?:abstract\\s+)?(?:async\\s+)?` +
      `(?:function\\*?|class|const|let|var|type|interface|enum)\\s+${name}\\b`,
  );
  const listed = new RegExp(`\\bexport\\s+(?:type\\s+)?\\{[^}]*\\b${name}\\b[^}]*\\}`);
  return declared.test(source) || listed.test(source);
}

/** Where a proof fails, or undefined when it holds. */
export function checkProof(
  proof: Proof,
  read: (path: string) => string | undefined,
  has: (path: string) => boolean,
): string | undefined {
  if (!has(proof.path)) return `${proof.path} doesn't exist`;
  if (!proof.symbol && !proof.test) return undefined;
  const source = read(proof.path);
  if (source === undefined) return `${proof.path} is a folder, so it can't hold a symbol or a test`;
  if (proof.symbol && !exportsSymbol(source, proof.symbol)) {
    return `${proof.path} doesn't export ${proof.symbol}`;
  }
  if (proof.test && !source.includes(proof.test)) {
    return `${proof.path} has no test "${proof.test}"`;
  }
  return undefined;
}

/**
 * Loads and checks every feature entry, in order. Throws one error listing
 * every invalid entry and every broken proof, each with its file.
 */
export function loadFeatures(
  dir: string,
  library: Pick<LibraryReader, 'read' | 'has'>,
  webRoot: string,
  /** `proofs: false` validates the entries without checking their proofs (unit tests). */
  opts: { proofs?: boolean } = {},
): Feature[] {
  const web = {
    has: (path: string): boolean => existsSync(join(webRoot, path)),
    read: (path: string): string | undefined => {
      try {
        return readFileSync(join(webRoot, path), 'utf8');
      } catch {
        return undefined;
      }
    },
  };
  const problems: string[] = [];
  const features: Feature[] = [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .toSorted();
  for (const file of files) {
    const where = `apps/site/content/features/${file}`;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (err) {
      problems.push(`${where}: not valid JSON (${String(err)})`);
      continue;
    }
    const parsed = featureSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${where}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      continue;
    }
    const f = parsed.data;
    if (`${f.id}.json` !== file)
      problems.push(`${where}: id "${f.id}" doesn't match the file name`);
    for (const proof of opts.proofs === false ? [] : f.proof) {
      const src = proof.repo === 'isoloop' ? library : web;
      const failure = checkProof(proof, src.read, src.has);
      if (failure) {
        problems.push(
          `${where}: proof in ${proof.repo === 'isoloop' ? 'isoloop/isoloop at the library pin' : 'isoloop/web'}: ${failure}`,
        );
      }
    }
    features.push(f);
  }
  const orders = new Map<number, string>();
  for (const f of features) {
    const other = orders.get(f.order);
    if (other) problems.push(`features ${other} and ${f.id} share order ${String(f.order)}`);
    orders.set(f.order, f.id);
  }
  if (features.length === 0 && problems.length === 0) problems.push(`no feature entries in ${dir}`);
  if (problems.length > 0) {
    throw new Error(`Feature entries (ADR 0004, decision 5):\n- ${problems.join('\n- ')}`);
  }
  return features.toSorted((a, b) => a.order - b.order);
}
